// ============================================================
// COMPASS.JS - Modul Sensor Kompas (Device Orientation API)
// ============================================================

import { normalizeAngle, showToast } from './utils.js';

// State internal modul
let currentHeading = null;
let isSensorActive = false;
let headingCallbacks = [];
let rawAlpha = null;
let rawBeta = null;
let rawGamma = null;
let webkitCompassHeading = null;

// Konfigurasi
const COMPASS_CONFIG = {
    // Filter simple moving average untuk menghaluskan heading
    smoothingFactor: 0.3,
    // Jumlah sampel untuk moving average
    sampleSize: 5,
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
 * Mengecek apakah iOS (memerlukan permission request)
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
    // Hanya iOS 13+ yang memerlukan permission eksplisit
    if (typeof DeviceOrientationEvent !== 'undefined') {
        // Cek apakah method requestPermission ada (iOS 13+)
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();

                if (permissionState === 'granted') {
                    console.log('✅ Permission sensor diberikan');
                    showToast('Sensor kompas diaktifkan', 'success', 3000);
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
            console.log('ℹ️ Device tidak memerlukan permission eksplisit');
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
    // Cek dukungan
    if (!isDeviceOrientationSupported()) {
        console.error('❌ Device Orientation tidak didukung');
        showToast('Sensor kompas tidak tersedia di perangkat ini', 'danger', 6000);
        updateCompassUIStatus('unsupported');
        showSensorAlert(true);
        return false;
    }

    // Untuk iOS, permission harus diminta via user gesture
    // Kita akan menampilkan tombol/tooltip untuk user
    if (isIOS() && typeof DeviceOrientationEvent.requestPermission === 'function') {
        console.log('ℹ️ iOS terdeteksi, menunggu permission...');
        updateCompassUIStatus('waiting_permission');
        showPermissionPrompt(true);
        return false; // Menunggu user memberikan permission
    }

    // Android: langsung pasang event listener
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
    window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
}

/**
 * Handler untuk event deviceorientation
 */
function handleOrientation(event) {
    // Simpan data mentah
    rawAlpha = event.alpha;   // 0-360, rotasi sekitar sumbu Z
    rawBeta = event.beta;     // -180-180, rotasi sekitar sumbu X
    rawGamma = event.gamma;   // -90-90, rotasi sekitar sumbu Y

    // Cek apakah ada webkitCompassHeading (iOS lama)
    if (event.webkitCompassHeading !== undefined) {
        webkitCompassHeading = event.webkitCompassHeading;
        updateHeading(webkitCompassHeading);
        return;
    }

    // Untuk Android: gunakan alpha (sudah absolut terhadap utara magnetik)
    // event.absolute === true jika menggunakan sensor absolut
    if (event.absolute === true && rawAlpha !== null) {
        // alpha pada Android biasanya sudah kompas heading
        // 0 = utara, 90 = timur, 180 = selatan, 270 = barat
        let heading = normalizeAngle(360 - rawAlpha); // Konversi ke heading geografis
        updateHeading(heading);
    } else if (rawAlpha !== null) {
        // Fallback: gunakan alpha meskipun tidak absolut
        let heading = normalizeAngle(360 - rawAlpha);
        updateHeading(heading);
    }
}

/**
 * Handler untuk event deviceorientationabsolute (lebih akurat)
 */
function handleAbsoluteOrientation(event) {
    if (event.absolute === true && event.alpha !== null) {
        let heading = normalizeAngle(360 - event.alpha);
        updateHeading(heading);
    }
}

/**
 * Update heading dengan smoothing
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

    // Batasi jumlah sampel
    if (headingSamples.length > COMPASS_CONFIG.sampleSize) {
        headingSamples.shift();
    }

    // Hitung rata-rata sederhana untuk smoothing
    let smoothedHeading = calculateSmoothedHeading();

    // Interpolasi dengan heading sebelumnya (lebih halus)
    if (currentHeading !== null) {
        // Gunakan lerpAngle dari utils (kita implementasikan di sini untuk mengurangi dependency)
        const diff = shortestAngleDifferenceLocal(currentHeading, smoothedHeading);
        smoothedHeading = normalizeAngle(currentHeading + diff * COMPASS_CONFIG.smoothingFactor);
    }

    // Update heading
    currentHeading = smoothedHeading;

    // Panggil semua callback yang terdaftar
    notifyCallbacks(currentHeading);

    // Update UI heading display
    updateHeadingDisplay(currentHeading);
}

/**
 * Menghitung smoothed heading dari sampel
 */
function calculateSmoothedHeading() {
    if (headingSamples.length === 0) return currentHeading || 0;

    // Karena sudut wrap-around, kita tidak bisa rata-rata langsung
    // Gunakan rata-rata vektor (konversi ke sin/cos)
    let sumSin = 0;
    let sumCos = 0;

    for (const sample of headingSamples) {
        const rad = sample * (Math.PI / 180);
        sumSin += Math.sin(rad);
        sumCos += Math.cos(rad);
    }

    const avgRad = Math.atan2(sumSin / headingSamples.length, sumCos / headingSamples.length);
    return normalizeAngle(avgRad * (180 / Math.PI));
}

/**
 * Menghitung selisih sudut terpendek (versi lokal)
 */
function shortestAngleDifferenceLocal(angle1, angle2) {
    let diff = normalizeAngle(angle2) - normalizeAngle(angle1);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
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
 * @returns {number|null} Heading dalam derajat (0-360) atau null
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
 * Reset heading (untuk kalibrasi)
 */
export function resetHeading() {
    headingSamples = [];
    // currentHeading tetap dipertahankan agar animasi tidak lompat
    console.log('🔄 Heading direset');
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

    // Update di card informasi kiblat
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

    switch (status) {
        case 'active':
            badge.innerHTML = '<span class="badge bg-success">Aktif</span>';
            break;
        case 'waiting_permission':
            badge.innerHTML = '<span class="badge bg-warning">Butuh Izin</span>';
            break;
        case 'denied':
            badge.innerHTML = '<span class="badge bg-danger">Izin Ditolak</span>';
            break;
        case 'unsupported':
            badge.innerHTML = '<span class="badge bg-danger">Tidak Didukung</span>';
            break;
        case 'error':
            badge.innerHTML = '<span class="badge bg-danger">Error</span>';
            break;
        case 'stopped':
            badge.innerHTML = '<span class="badge bg-secondary">Nonaktif</span>';
            break;
        default:
            badge.innerHTML = '<span class="badge bg-secondary">Menunggu...</span>';
            break;
    }
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
 * Tampilkan/sembunyikan prompt permission (untuk iOS)
 */
function showPermissionPrompt(show) {
    const btnCalibrate = document.getElementById('btnCalibrate');

    if (btnCalibrate) {
        if (show) {
            btnCalibrate.textContent = '🔓 Izinkan Sensor';
            btnCalibrate.classList.remove('btn-outline-primary');
            btnCalibrate.classList.add('btn-warning');
            btnCalibrate.disabled = false;
            btnCalibrate.style.display = 'inline-block';
        } else {
            btnCalibrate.textContent = '🔄 Kalibrasi';
            btnCalibrate.classList.remove('btn-warning');
            btnCalibrate.classList.add('btn-outline-primary');
        }
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
