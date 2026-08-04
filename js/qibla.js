// ============================================================
// QIBLA.JS - Modul Perhitungan Arah Kiblat & Jarak
// ============================================================

import { toRadians, toDegrees, normalizeAngle, shortestAngleDifference, formatNumber } from './utils.js';

// Koordinat Ka'bah (Makkah)
const KAABAH = {
    latitude: 21.422487,
    longitude: 39.826206,
};

/**
 * Menghitung initial bearing (azimuth) dari titik A ke titik B
 * Menggunakan rumus spherical trigonometry (Great Circle)
 *
 * Formula:
 * θ = atan2(sin(Δλ) * cos(φ2),
 *           cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(Δλ))
 *
 * @param {number} lat1 - Latitude titik asal (derajat)
 * @param {number} lon1 - Longitude titik asal (derajat)
 * @param {number} lat2 - Latitude titik tujuan (derajat)
 * @param {number} lon2 - Longitude titik tujuan (derajat)
 * @returns {number} Bearing dalam derajat (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
    // Validasi input
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
        isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        console.error('❌ calculateBearing: Input tidak valid', { lat1, lon1, lat2, lon2 });
        return null;
    }

    // Konversi ke radian
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const λ1 = toRadians(lon1);
    const λ2 = toRadians(lon2);

    // Selisih longitude
    const Δλ = λ2 - λ1;

    // Rumus initial bearing
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    // atan2 menghasilkan sudut dalam radian
    const θ = Math.atan2(y, x);

    // Konversi ke derajat dan normalisasi ke 0-360
    const bearing = normalizeAngle(toDegrees(θ));

    return bearing;
}

/**
 * Menghitung bearing dari posisi user ke Ka'bah
 * @param {number} userLat - Latitude user
 * @param {number} userLon - Longitude user
 * @returns {number|null} Bearing ke Ka'bah dalam derajat (0-360)
 */
export function getQiblaBearing(userLat, userLon) {
    if (userLat === null || userLon === null || isNaN(userLat) || isNaN(userLon)) {
        console.warn('⚠️ getQiblaBearing: Posisi user tidak valid');
        return null;
    }

    const bearing = calculateBearing(userLat, userLon, KAABAH.latitude, KAABAH.longitude);

    console.log(`🕋 Bearing Kiblat: ${bearing?.toFixed(2)}° (dari ${userLat.toFixed(4)}, ${userLon.toFixed(4)})`);

    return bearing;
}

/**
 * Menghitung jarak antara dua titik menggunakan rumus Haversine
 *
 * Formula Haversine:
 * a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
 * c = 2 * atan2(√a, √(1-a))
 * d = R * c
 *
 * @param {number} lat1 - Latitude titik 1 (derajat)
 * @param {number} lon1 - Longitude titik 1 (derajat)
 * @param {number} lat2 - Latitude titik 2 (derajat)
 * @param {number} lon2 - Longitude titik 2 (derajat)
 * @returns {number} Jarak dalam kilometer
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    // Validasi input
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
        isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        console.error('❌ calculateDistance: Input tidak valid');
        return null;
    }

    // Radius bumi dalam kilometer (rata-rata)
    const R = 6371;

    // Konversi ke radian
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    // Rumus Haversine
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Jarak dalam kilometer
    const distance = R * c;

    return distance;
}

/**
 * Menghitung jarak dari user ke Ka'bah
 * @param {number} userLat - Latitude user
 * @param {number} userLon - Longitude user
 * @returns {number|null} Jarak dalam kilometer
 */
export function getDistanceToKaabah(userLat, userLon) {
    if (userLat === null || userLon === null || isNaN(userLat) || isNaN(userLon)) {
        console.warn('⚠️ getDistanceToKaabah: Posisi user tidak valid');
        return null;
    }

    const distance = calculateDistance(userLat, userLon, KAABAH.latitude, KAABAH.longitude);

    console.log(`📏 Jarak ke Ka'bah: ${distance?.toFixed(2)} km`);

    return distance;
}

/**
 * Menghitung selisih antara heading device dan bearing kiblat
 * @param {number} deviceHeading - Heading perangkat (0-360 derajat)
 * @param {number} qiblaBearing - Bearing kiblat (0-360 derajat)
 * @returns {number|null} Selisih sudut (-180 sampai 180)
 */
export function getQiblaAngleDifference(deviceHeading, qiblaBearing) {
    if (deviceHeading === null || qiblaBearing === null ||
        isNaN(deviceHeading) || isNaN(qiblaBearing)) {
        return null;
    }

    return shortestAngleDifference(deviceHeading, qiblaBearing);
}

/**
 * Menghitung rotasi yang diperlukan untuk panah kiblat
 * Panah harus berputar berlawanan dengan heading device
 * agar selalu menunjuk ke arah kiblat
 *
 * @param {number} deviceHeading - Heading perangkat saat ini
 * @param {number} qiblaBearing - Bearing kiblat
 * @returns {number} Sudut rotasi untuk panah (derajat)
 */
export function getArrowRotation(deviceHeading, qiblaBearing) {
    if (deviceHeading === null || qiblaBearing === null ||
        isNaN(deviceHeading) || isNaN(qiblaBearing)) {
        return 0;
    }

    // Panah harus menunjuk ke arah kiblat relatif terhadap layar
    // Jika device menghadap utara (heading 0), panah harus menunjuk ke bearing kiblat
    // Jika device berputar, panah harus menyesuaikan

    // Rotasi panah = qiblaBearing - deviceHeading
    // Panah selalu "diam" menunjuk kiblat, background yang berputar
    // Jadi rotasi panah = -deviceHeading + qiblaBearing
    // Atau: panah dirotasi sehingga tetap menunjuk arah absolut kiblat

    const arrowRotation = normalizeAngle(qiblaBearing - deviceHeading);

    return arrowRotation;
}

/**
 * Mengecek apakah user sudah menghadap kiblat
 * (selisih sudut kurang dari threshold)
 * @param {number} angleDifference - Selisih sudut absolut
 * @param {number} threshold - Threshold dalam derajat (default: 3)
 * @returns {boolean}
 */
export function isFacingQibla(angleDifference, threshold = 3) {
    if (angleDifference === null || isNaN(angleDifference)) {
        return false;
    }

    // Gunakan nilai absolut selisih
    const absDiff = Math.abs(angleDifference);
    return absDiff <= threshold;
}

/**
 * Menghitung semua data kiblat sekaligus
 * @param {number} userLat - Latitude user
 * @param {number} userLon - Longitude user
 * @param {number} deviceHeading - Heading perangkat
 * @returns {object} Object berisi semua informasi kiblat
 */
export function calculateQiblaData(userLat, userLon, deviceHeading) {
    // Default result
    const result = {
        qiblaBearing: null,
        distance: null,
        angleDifference: null,
        arrowRotation: null,
        isFacingQibla: false,
        isValid: false,
    };

    // Validasi input
    if (userLat === null || userLon === null ||
        isNaN(userLat) || isNaN(userLon)) {
        console.warn('⚠️ calculateQiblaData: Posisi user tidak valid');
        return result;
    }

    // Hitung bearing kiblat
    const qiblaBearing = getQiblaBearing(userLat, userLon);
    if (qiblaBearing === null) {
        console.error('❌ Gagal menghitung bearing kiblat');
        return result;
    }

    // Hitung jarak
    const distance = getDistanceToKaabah(userLat, userLon);

    // Default: heading null
    let angleDifference = null;
    let arrowRotation = 0;
    let facingQibla = false;

    // Jika heading tersedia, hitung selisih dan rotasi
    if (deviceHeading !== null && !isNaN(deviceHeading)) {
        angleDifference = getQiblaAngleDifference(deviceHeading, qiblaBearing);
        arrowRotation = getArrowRotation(deviceHeading, qiblaBearing);
        facingQibla = isFacingQibla(angleDifference);
    }

    // Populate result
    result.qiblaBearing = qiblaBearing;
    result.distance = distance;
    result.angleDifference = angleDifference;
    result.arrowRotation = arrowRotation;
    result.isFacingQibla = facingQibla;
    result.isValid = true;

    return result;
}

/**
 * Format data kiblat untuk ditampilkan di UI
 * @param {object} qiblaData - Hasil dari calculateQiblaData()
 * @returns {object} Data yang sudah diformat untuk UI
 */
export function formatQiblaDataForUI(qiblaData) {
    return {
        qiblaBearing: qiblaData.qiblaBearing !== null
            ? `${qiblaData.qiblaBearing.toFixed(1)}°`
            : '--°',
        distance: qiblaData.distance !== null
            ? `${formatNumber(qiblaData.distance, 0)} km`
            : '-- km',
        angleDifference: qiblaData.angleDifference !== null
            ? `${qiblaData.angleDifference.toFixed(1)}°`
            : '--°',
        arrowRotation: qiblaData.arrowRotation !== null
            ? qiblaData.arrowRotation
            : 0,
        isFacingQibla: qiblaData.isFacingQibla,
        isValid: qiblaData.isValid,
    };
}

/**
 * Mendapatkan koordinat Ka'bah (untuk referensi)
 * @returns {object} { latitude, longitude }
 */
export function getKaabahCoordinates() {
    return { ...KAABAH };
}
