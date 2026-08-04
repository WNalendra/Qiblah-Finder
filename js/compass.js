// ============================================================
// COMPASS.JS - Modul Sensor Kompas (Device Orientation API)
// Revisi Final
// ============================================================

import { normalizeAngle, lerpAngle, showToast } from './utils.js';

// State internal modul
let currentHeading = null;
let isSensorActive = false;
let headingCallbacks = [];
let rawAlpha = null;
let rawBeta = null;
let rawGamma = null;
let webkitCompassHeading = null;

// Konfigurasi smoothing
const COMPASS_CONFIG = {
    smoothingFactor: 0.25,    // Faktor interpolasi (0-1)
    sampleSize: 8,            // Jumlah sampel moving average
};

// Array untuk menyimpan sampel heading
let headingSamples = [];

/**
 * Mengecek apakah Device Orientation API didukung
 * @returns {boolean}
 */
export function isDeviceOrientationSupported() {
    return 'DeviceOrientationEvent' in window;
}

/**
 * Mengecek apakah ini perangkat iOS
 * @returns {boolean}
 */
function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Meminta permission sensor untuk iOS 13+
 * Harus dipanggil dari user gesture (click/touch)
 * @returns {Promise<boolean>} Apakah permission diberikan
 */
export async function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();

                if (permissionState === 'granted') {
                    console.log('✅ Permission sensor diberikan');
                    showToast('Sensor kompas diaktifkan!', 'success', 3000);
                    return true;
                } else {
                    console.warn('❌ Permission sensor ditolak');
                    showToast('Izin sensor ditolak. Arah kiblat tidak tersedia.', 'warning', 5000);
                    updateCompassUIStatus('denied');
                    return false;
                }
            } catch (error) {
                console.error('❌ Error requesting permission:', error);
                showToast('Gagal meminta izin sensor', 'danger');
                updateCompassUIStatus('error');
                return false;
            }
        } else {
            // Android atau iOS < 13: tidak perlu permission eksplisit
            return true;
        }
    }

    return false;
}

/**
 * Memulai mendengarkan event device orientation
 * @returns {Promise<boolean>} Apakah sensor berhasil diaktifkan
 */
export async function startCompass() {
    if (!isDeviceOrientationSupported()) {
        console.error('❌ Device Orientation tidak didukung');
        showToast('Sensor kompas tidak tersedia di perangkat ini', 'danger', 6000);
        updateCompassUIStatus('unsupported');
        showSensorAlert(true);
        return false;
    }

    // Untuk iOS 13+, permission harus diminta via user gesture
    if (isIOS() && typeof DeviceOrientationEvent.requestPermission === 'function') {
        console.log('ℹ️ iOS terdeteksi, menunggu permission dari user...');
        updateCompassUIStatus('waiting_permission');
        showPermissionPrompt(true);
        return false;
    }

    // Android / iOS < 13: langsung pasang event listener
    attachOrientationListener();
    isSensorActive = true;
    updateCompassUIStatus('active');
    showSensorAlert(false);
    console.log('✅ Sensor kompas dimulai');
    return true;
}

/**
 * Memasang event listener DeviceOrientation
 */
function attachOrientationListener() {
    window.addEventListener('deviceorientation', handleOrientation, true);

    // Beberapa browser mendukung event absolut
    if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
    }
}

/**
 * Handler untuk event deviceorientation
 */
function handleOrientation(event) {
    // Simpan data mentah
    rawAlpha = event.alpha;
    rawBeta = event.beta;
    rawGamma = event.gamma;

    // Cek webkitCompassHeading (iOS lama)
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        webkitCompassHeading = event.webkitCompassHeading;
        updateHeading(webkitCompassHeading);
        return;
    }

    // Gunakan alpha jika tersedia
    if (rawAlpha !== null && !isNaN(rawAlpha)) {
        // Konversi alpha ke heading geografis
        // alpha: 0-360, 0 = arah layar atas
        // heading: 0 = Utara, 90 = Timur
        let heading = normalizeAngle(360 - rawAlpha);
        updateHeading(heading);
    }
}

/**
 * Handler untuk event deviceorientationabsolute (lebih akurat)
 */
function handleAbsoluteOrientation(event) {
    if (event.absolute === true && event.alpha !== null && !isNaN(event.alpha)) {
        let heading = normalizeAngle(360 - event.alpha);
        updateHeading(heading);
    }
}

/**
 * Update heading dengan smoothing dan moving average
 * @param {number} newHeading - Heading baru dari sensor
 */
function updateHeading(newHeading) {
    if (newHeading === null || newHeading === undefined || isNaN(newHeading)) {
        return;
    }

    // Normalisasi
    newHeading = normalizeAngle(newHeading);

    // Tambahkan ke sampel
    headingSamples.push(newHeading);
    if (headingSamples.length > COMPASS_CONFIG.sampleSize) {
        headingSamples.shift();
    }

    // Hitung rata-rata vektor untuk menghindari masalah wrap-around
    const smoothedHeading = calculateVectorAverage(headingSamples);

    // Interpolasi dengan heading sebelumnya untuk animasi lebih halus
    if (currentHeading !== null) {
        currentHeading = lerpAngle(currentHeading, smoothedHeading, COMPASS_CONFIG.smoothingFactor);
    } else {
        currentHeading = smoothedHeading;
    }

    // Panggil semua callback yang terdaftar
    notifyCallbacks(currentHeading);

    // Update UI heading display
    updateHeadingDisplay(currentHeading);
}

/**
 * Menghitung rata-rata vektor dari sampel sudut
 * Menghindari masalah wrap-around 360°/0°
 */
function calculateVectorAverage(samples) {
    if (samples.length === 0) return currentHeading || 0;
    if (samples.length === 1) return samples[0];

    let sumSin = 0;
    let sumCos = 0;

    for (const sample of samples) {
        const rad = sample * (Math.PI / 180);
        sumSin += Math.sin(rad);
        sumCos += Math.cos(rad);
    }

    const avgRad = Math.atan2(sumSin / samples.length, sumCos / samples.length);
    return normalizeAngle(avgRad * (180 / Math.PI));
}

/**
 * Mendaftarkan callback untuk update heading
 * @param {function} callback - Fungsi yang dipanggil dengan heading baru
 * @returns {function} Fungsi untuk unregister callback
 */
export function onHeadingUpdate(callback) {
    if (typeof callback !== 'function') {
        console.warn('⚠️ onHeadingUpdate: parameter harus fungsi');
        return () => {};
    }

    headingCallbacks.push(callback);

    // Jika sensor sudah aktif dan heading tersedia, langsung panggil callback
    if (isSensorActive && currentHeading !== null) {
        try {
            callback(currentHeading);
        } catch (error) {
            console.error('Error di heading callback:', error);
        }
    }

    // Return fungsi untuk unregister
    return () => {
        headingCallbacks = headingCallbacks.filter(cb => cb !== callback);
    };
}

/**
 * Memanggil semua callback dengan heading terbaru
 */
function notifyCallbacks(heading) {
    for (const callback of headingCallbacks) {
        try {
            callback(heading);
        } catch (error) {
            console.error('Error di heading callback:', error);
        }
    }
}

/**
 * Mendapatkan heading saat ini
 * @returns {number|null}
 */
export function getCurrentHeading() {
    return currentHeading;
}

/**
 * Mengecek apakah sensor kompas aktif
 * @returns {boolean}
 */
export function isCompassActive() {
    return isSensorActive;
}

/**
 * Memberhentikan sensor kompas
 */
export function stopCompass() {
    window.removeEventListener('deviceorientation', handleOrientation, true);
    window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
    isSensorActive = false;
    headingSamples = [];
    updateCompassUIStatus('stopped');
    console.log('🛑 Sensor kompas dihentikan');
}

/**
 * Reset heading samples (untuk kalibrasi)
 */
export function resetHeading() {
    headingSamples = [];
    console.log('🔄 Heading samples direset');
}

// ============================================================
// UI Helpers
// ============================================================

/**
 * Update tampilan heading di kompas
 */
function updateHeadingDisplay(heading) {
    const display = document.getElementById('compassHeadingDisplay');
    if (display) {
        display.textContent = `${Math.round(heading)}°`;
    }

    const infoHeading = document.getElementById('infoDeviceHeading');
    if (infoHeading) {
        infoHeading.textContent = `${heading.toFixed(1)}°`;
    }
}

/**
 * Update status sensor di UI
 */
function updateCompassUIStatus(status) {
    const badge = document.getElementById('infoCompassStatus');
    if (!badge) return;

    const statusMap = {
        'active': '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aktif</span>',
        'waiting_permission': '<span class="badge bg-warning"><i class="bi bi-unlock me-1"></i>Butuh Izin</span>',
        'denied': '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Izin Ditolak</span>',
        'unsupported': '<span class="badge bg-danger"><i class="bi bi-exclamation-circle me-1"></i>Tidak Didukung</span>',
        'error': '<span class="badge bg-danger"><i class="bi bi-bug me-1"></i>Error</span>',
        'stopped': '<span class="badge bg-secondary"><i class="bi bi-stop-circle me-1"></i>Nonaktif</span>',
    };

    badge.innerHTML = statusMap[status] || '<span class="badge bg-secondary">Menunggu...</span>';
}

/**
 * Tampilkan/sembunyikan alert sensor tidak tersedia
 */
function showSensorAlert(show) {
    const alert = document.getElementById('alertSensorUnavailable');
    if (alert) {
        if (show) {
            alert.classList.remove('d-none');
        } else {
            alert.classList.add('d-none');
        }
    }
}

/**
 * Tampilkan prompt permission di tombol kalibrasi (untuk iOS)
 */
function showPermissionPrompt(show) {
    const btnCalibrate = document.getElementById('btnCalibrate');
    if (!btnCalibrate) return;

    if (show) {
        btnCalibrate.innerHTML = '<i class="bi bi-unlock me-1"></i> Izinkan Sensor';
        btnCalibrate.classList.remove('btn-outline-primary');
        btnCalibrate.classList.add('btn-warning');
        btnCalibrate.disabled = false;
        btnCalibrate.style.display = 'inline-block';
    } else {
        btnCalibrate.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Kalibrasi Kompas';
        btnCalibrate.classList.remove('btn-warning');
        btnCalibrate.classList.add('btn-outline-primary');
    }
}

/**
 * Menampilkan loading spinner kompas
 */
export function showCompassLoading(show) {
    const loading = document.getElementById('compassLoading');
    const container = document.getElementById('compassContainer');

    if (loading) {
        if (show) {
            loading.classList.remove('d-none');
        } else {
            loading.classList.add('d-none');
        }
    }

    if (container) {
        if (show) {
            container.classList.add('d-none');
        } else {
            container.classList.remove('d-none');
            container.classList.add('fade-in');
        }
    }
}

/**
 * Mengembalikan data mentah sensor (untuk debugging)
 */
export function getRawSensorData() {
    return {
        alpha: rawAlpha,
        beta: rawBeta,
        gamma: rawGamma,
        webkitCompassHeading: webkitCompassHeading,
        heading: currentHeading,
        isActive: isSensorActive
    };
}
