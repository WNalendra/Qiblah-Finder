// ============================================================
// UTILS.JS - Fungsi-fungsi Bantuan (Helper Functions)
// ============================================================

/**
 * Mengkonversi derajat ke radian
 * @param {number} deg - Sudut dalam derajat
 * @returns {number} Sudut dalam radian
 */
export function toRadians(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Mengkonversi radian ke derajat
 * @param {number} rad - Sudut dalam radian
 * @returns {number} Sudut dalam derajat
 */
export function toDegrees(rad) {
    return rad * (180 / Math.PI);
}

/**
 * Normalisasi sudut ke rentang 0 - 360 derajat
 * @param {number} angle - Sudut yang akan dinormalisasi
 * @returns {number} Sudut dalam rentang 0-360
 */
export function normalizeAngle(angle) {
    let normalized = angle % 360;
    if (normalized < 0) {
        normalized += 360;
    }
    return normalized;
}

/**
 * Menghitung selisih terpendek antara dua sudut (dalam derajat)
 * Mempertimbangkan wrap-around di 360°/0°
 * @param {number} angle1 - Sudut pertama (derajat)
 * @param {number} angle2 - Sudut kedua (derajat)
 * @returns {number} Selisih sudut (-180 sampai 180)
 */
export function shortestAngleDifference(angle1, angle2) {
    let diff = normalizeAngle(angle2) - normalizeAngle(angle1);

    if (diff > 180) {
        diff -= 360;
    } else if (diff < -180) {
        diff += 360;
    }

    return diff;
}

/**
 * Interpolasi linear antara dua sudut untuk animasi halus
 * Menangani wrap-around 360°/0° dengan benar
 * @param {number} current - Sudut saat ini (derajat)
 * @param {number} target - Sudut target (derajat)
 * @param {number} factor - Faktor interpolasi (0-1), semakin kecil semakin halus
 * @returns {number} Sudut hasil interpolasi
 */
export function lerpAngle(current, target, factor = 0.1) {
    let diff = shortestAngleDifference(current, target);
    return normalizeAngle(current + diff * factor);
}

/**
 * Format angka desimal ke string dengan presisi tertentu
 * @param {number} num - Angka yang akan diformat
 * @param {number} decimals - Jumlah desimal (default: 2)
 * @returns {string} Angka terformat
 */
export function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) {
        return '--';
    }
    return Number(num).toFixed(decimals);
}

/**
 * Membuat elemen toast Bootstrap dan menampilkannya
 * @param {string} message - Pesan toast
 * @param {string} type - Tipe toast: 'success', 'danger', 'warning', 'info'
 * @param {number} delay - Durasi tampil dalam ms (default: 4000)
 */
export function showToast(message, type = 'info', delay = 4000) {
    const toastContainer = document.getElementById('toastContainer');

    if (!toastContainer) {
        console.error('Toast container tidak ditemukan');
        return;
    }

    // Warna berdasarkan tipe
    const bgColors = {
        success: 'bg-success text-white',
        danger: 'bg-danger text-white',
        warning: 'bg-warning text-dark',
        info: 'bg-info text-dark'
    };

    const icons = {
        success: 'bi-check-circle-fill',
        danger: 'bi-x-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill'
    };

    const bgColor = bgColors[type] || bgColors.info;
    const icon = icons[type] || icons.info;

    // Buat elemen toast
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center ${bgColor} border-0 fade-in`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi ${icon} fs-5"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Tutup"></button>
        </div>
    `;

    toastContainer.appendChild(toastEl);

    // Inisialisasi Bootstrap Toast
    const toast = new bootstrap.Toast(toastEl, {
        delay: delay,
        autohide: true
    });

    toast.show();

    // Hapus elemen setelah toast hilang
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

/**
 * Mengecek apakah browser mendukung API yang diperlukan
 * @returns {object} Object berisi status dukungan
 */
export function checkBrowserSupport() {
    const support = {
        geolocation: 'geolocation' in navigator,
        deviceOrientation: 'DeviceOrientationEvent' in window,
        // iOS 13+ memerlukan requestPermission
        deviceOrientationAbsolute: false
    };

    // Cek absolute orientation (kompas sejati)
    if (support.deviceOrientation) {
        // Kita akan cek saat event listener dipasang
        support.deviceOrientationAbsolute = true;
    }

    return support;
}

/**
 * Sleep / delay menggunakan Promise
 * @param {number} ms - Waktu delay dalam milidetik
 * @returns {Promise} Promise yang resolve setelah delay
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
