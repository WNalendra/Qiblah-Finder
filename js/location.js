// ============================================================
// LOCATION.JS - Modul Geolocation API
// ============================================================

import { showToast } from './utils.js';

// State internal modul
let currentPosition = null;
let watchId = null;

// Konfigurasi
const GPS_CONFIG = {
    enableHighAccuracy: true,
    timeout: 15000,          // 15 detik timeout
    maximumAge: 60000,       // Cache maksimal 1 menit
};

/**
 * Meminta posisi sekali (one-time)
 * @returns {Promise<object>} Object berisi latitude, longitude, accuracy, timestamp
 */
export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        // Cek dukungan geolocation
        if (!navigator.geolocation) {
            const error = new Error('Geolocation tidak didukung oleh browser ini');
            showToast('Browser tidak mendukung Geolocation API', 'danger');
            reject(error);
            return;
        }

        // Update UI: tampilkan loading
        showGPSLoading(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Sukses mendapatkan posisi
                const posData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp
                };

                currentPosition = posData;

                // Update UI
                showGPSLoading(false);
                updateLocationUI(posData);
                updateGPSStatus('active');

                console.log('📍 Posisi GPS diperoleh:', posData);
                showToast('Lokasi berhasil diperoleh', 'success', 3000);

                resolve(posData);
            },
            (error) => {
                // Gagal mendapatkan posisi
                showGPSLoading(false);
                updateGPSStatus('error');

                let errorMessage = 'Gagal mendapatkan lokasi';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Izin akses lokasi ditolak. Silakan aktifkan GPS dan izinkan akses lokasi.';
                        showToast(errorMessage, 'danger', 6000);
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Informasi lokasi tidak tersedia. Periksa koneksi dan sinyal GPS.';
                        showToast(errorMessage, 'warning', 5000);
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Waktu permintaan lokasi habis. Coba lagi.';
                        showToast(errorMessage, 'warning', 5000);
                        break;
                    default:
                        showToast(errorMessage, 'danger', 5000);
                        break;
                }

                console.error('❌ GPS Error:', error);
                updateLocationUI(null, errorMessage);

                reject(new Error(errorMessage));
            },
            GPS_CONFIG
        );
    });
}

/**
 * Memulai watchPosition untuk update lokasi berkelanjutan
 * @returns {Promise<object>} Posisi pertama yang didapat
 */
export async function startWatchingPosition() {
    // Dapatkan posisi awal
    const initialPosition = await getCurrentPosition().catch(() => null);

    // Mulai watch (opsional, untuk update berkala)
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const posData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp
                };

                // Update hanya jika posisi berubah signifikan (akurasi membaik)
                if (shouldUpdatePosition(posData)) {
                    currentPosition = posData;
                    updateLocationUI(posData);
                }
            },
            (error) => {
                console.warn('⚠️ Watch position error:', error);
            },
            GPS_CONFIG
        );
    }

    return initialPosition;
}

/**
 * Memberhentikan watch position
 */
export function stopWatchingPosition() {
    if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log('🛑 Watch position dihentikan');
    }
}

/**
 * Mengembalikan posisi terakhir yang tersimpan
 * @returns {object|null} Posisi terakhir atau null
 */
export function getLastPosition() {
    return currentPosition;
}

/**
 * Memutuskan apakah posisi baru harus menggantikan posisi lama
 * (update jika akurasi lebih baik atau jarak > 5 meter)
 */
function shouldUpdatePosition(newPos) {
    if (!currentPosition) return true;

    // Update jika akurasi lebih baik (lebih kecil)
    if (newPos.accuracy < currentPosition.accuracy) {
        return true;
    }

    // Hitung jarak kasar (rumus haversine sederhana untuk cek signifikan)
    const latDiff = Math.abs(newPos.latitude - currentPosition.latitude);
    const lonDiff = Math.abs(newPos.longitude - currentPosition.longitude);

    // ~0.00005 derajat ≈ 5 meter
    if (latDiff > 0.00005 || lonDiff > 0.00005) {
        return true;
    }

    return false;
}

/**
 * Update UI dengan data lokasi
 */
function updateLocationUI(posData, errorMessage = null) {
    const gpsLoading = document.getElementById('gpsLoading');
    const gpsInfo = document.getElementById('gpsInfo');
    const alertGPSFailed = document.getElementById('alertGPSFailed');
    const alertGPSMessage = document.getElementById('alertGPSMessage');

    // Sembunyikan loading, tampilkan info
    if (gpsLoading) gpsLoading.classList.add('d-none');

    if (posData && !errorMessage) {
        // Tampilkan data GPS
        if (gpsInfo) gpsInfo.classList.remove('d-none');
        if (alertGPSFailed) alertGPSFailed.classList.add('d-none');

        // Update nilai
        setElementText('infoLatitude', posData.latitude.toFixed(6));
        setElementText('infoLongitude', posData.longitude.toFixed(6));
        setElementText('infoAccuracy', `${posData.accuracy.toFixed(1)} m`);
    } else if (errorMessage) {
        // Tampilkan error
        if (gpsInfo) gpsInfo.classList.add('d-none');
        if (alertGPSFailed) {
            alertGPSFailed.classList.remove('d-none');
            if (alertGPSMessage) alertGPSMessage.textContent = errorMessage;
        }

        // Set nilai ke default
        setElementText('infoLatitude', '--');
        setElementText('infoLongitude', '--');
        setElementText('infoAccuracy', '--');
    }
}

/**
 * Tampilkan/sembunyikan loading spinner GPS
 */
function showGPSLoading(show) {
    const gpsLoading = document.getElementById('gpsLoading');
    const gpsInfo = document.getElementById('gpsInfo');

    if (gpsLoading) {
        if (show) {
            gpsLoading.classList.remove('d-none');
        } else {
            gpsLoading.classList.add('d-none');
        }
    }

    if (gpsInfo && show) {
        gpsInfo.classList.add('d-none');
    }
}

/**
 * Update status GPS di Card Status Sensor
 */
function updateGPSStatus(status) {
    const badge = document.getElementById('infoGPSSensorStatus');

    if (!badge) return;

    switch (status) {
        case 'active':
            badge.innerHTML = '<span class="badge bg-success">Aktif</span>';
            break;
        case 'error':
            badge.innerHTML = '<span class="badge bg-danger">Gagal</span>';
            break;
        case 'searching':
            badge.innerHTML = '<span class="badge bg-warning">Mencari...</span>';
            break;
        default:
            badge.innerHTML = '<span class="badge bg-secondary">Menunggu...</span>';
            break;
    }

    // Update juga badge di card lokasi
    const gpsStatusBadge = document.getElementById('infoGPSStatus');
    if (gpsStatusBadge) {
        switch (status) {
            case 'active':
                gpsStatusBadge.innerHTML = '<span class="badge bg-success">Aktif</span>';
                break;
            case 'error':
                gpsStatusBadge.innerHTML = '<span class="badge bg-danger">Gagal</span>';
                break;
            case 'searching':
                gpsStatusBadge.innerHTML = '<span class="badge bg-warning">Mencari...</span>';
                break;
        }
    }
}

/**
 * Helper: set text content elemen by ID
 */
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
    }
}

/**
 * Reset lokasi (digunakan untuk refresh)
 */
export async function refreshLocation() {
    updateGPSStatus('searching');
    return getCurrentPosition();
}
