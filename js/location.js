// ============================================================
// LOCATION.JS - Modul Geolocation API
// Revisi Final
// ============================================================

import { showToast } from './utils.js';

let currentPosition = null;
let watchId = null;

const GPS_CONFIG = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
};

/**
 * Meminta posisi sekali (one-time)
 * @returns {Promise<object>}
 */
export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            const error = new Error('Geolocation tidak didukung');
            showToast('Browser tidak mendukung Geolocation API', 'danger');
            reject(error);
            return;
        }

        showGPSLoading(true);
        updateGPSStatus('searching');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const posData = extractPositionData(position);
                currentPosition = posData;

                showGPSLoading(false);
                updateLocationUI(posData);
                updateGPSStatus('active');

                console.log('📍 Posisi GPS:', posData.latitude.toFixed(6), posData.longitude.toFixed(6));
                showToast('Lokasi berhasil diperoleh', 'success', 3000);

                resolve(posData);
            },
            (error) => {
                showGPSLoading(false);
                updateGPSStatus('error');

                const errorMessage = getGPSErrorMessage(error);
                showToast(errorMessage, 'danger', 6000);

                console.error('❌ GPS Error:', error);
                updateLocationUI(null, errorMessage);

                reject(new Error(errorMessage));
            },
            GPS_CONFIG
        );
    });
}

/**
 * Mendapatkan pesan error GPS yang user-friendly
 */
function getGPSErrorMessage(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return 'Izin akses lokasi ditolak. Silakan aktifkan GPS di pengaturan.';
        case error.POSITION_UNAVAILABLE:
            return 'Informasi lokasi tidak tersedia. Periksa sinyal GPS.';
        case error.TIMEOUT:
            return 'Waktu permintaan lokasi habis. Coba lagi di area terbuka.';
        default:
            return 'Gagal mendapatkan lokasi. Silakan coba lagi.';
    }
}

/**
 * Ekstrak data posisi dari object Position
 */
function extractPositionData(position) {
    return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp
    };
}

/**
 * Memulai watchPosition untuk update lokasi berkelanjutan
 */
export async function startWatchingPosition() {
    const initialPosition = await getCurrentPosition().catch(() => null);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const posData = extractPositionData(position);
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
    }
}

/**
 * Mengembalikan posisi terakhir
 */
export function getLastPosition() {
    return currentPosition;
}

/**
 * Memutuskan apakah posisi baru signifikan
 */
function shouldUpdatePosition(newPos) {
    if (!currentPosition) return true;

    if (newPos.accuracy < currentPosition.accuracy) return true;

    const latDiff = Math.abs(newPos.latitude - currentPosition.latitude);
    const lonDiff = Math.abs(newPos.longitude - currentPosition.longitude);

    if (latDiff > 0.00005 || lonDiff > 0.00005) return true;

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

    if (gpsLoading) gpsLoading.classList.add('d-none');

    if (posData && !errorMessage) {
        if (gpsInfo) gpsInfo.classList.remove('d-none');
        if (alertGPSFailed) alertGPSFailed.classList.add('d-none');

        setElementText('infoLatitude', posData.latitude.toFixed(6));
        setElementText('infoLongitude', posData.longitude.toFixed(6));
        setElementText('infoAccuracy', `${posData.accuracy.toFixed(1)} m`);
    } else if (errorMessage) {
        if (gpsInfo) gpsInfo.classList.add('d-none');
        if (alertGPSFailed) {
            alertGPSFailed.classList.remove('d-none');
            if (alertGPSMessage) alertGPSMessage.textContent = errorMessage;
        }

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
        show ? gpsLoading.classList.remove('d-none') : gpsLoading.classList.add('d-none');
    }
    if (gpsInfo && show) {
        gpsInfo.classList.add('d-none');
    }
}

/**
 * Update status GPS di UI
 */
function updateGPSStatus(status) {
    const statusMap = {
        'active': '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aktif</span>',
        'error': '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Gagal</span>',
        'searching': '<span class="badge bg-warning"><i class="bi bi-search me-1"></i>Mencari...</span>',
    };

    // Update di card status sensor
    const sensorBadge = document.getElementById('infoGPSSensorStatus');
    if (sensorBadge) {
        sensorBadge.innerHTML = statusMap[status] || '<span class="badge bg-secondary">Menunggu...</span>';
    }

    // Update di card lokasi
    const gpsStatusBadge = document.getElementById('infoGPSStatus');
    if (gpsStatusBadge) {
        gpsStatusBadge.innerHTML = statusMap[status] || '<span class="badge bg-warning">Mencari...</span>';
    }
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/**
 * Refresh lokasi (untuk tombol refresh)
 */
export async function refreshLocation() {
    updateGPSStatus('searching');
    return getCurrentPosition();
}
