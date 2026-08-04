// ============================================================
// QIBLA.JS - Modul Perhitungan Arah Kiblat & Jarak
// Update: Tambah fungsi panduan arah
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
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
        isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        console.error('❌ calculateBearing: Input tidak valid', { lat1, lon1, lat2, lon2 });
        return null;
    }

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const λ1 = toRadians(lon1);
    const λ2 = toRadians(lon2);
    const Δλ = λ2 - λ1;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
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
 * @param {number} lat1 - Latitude titik 1 (derajat)
 * @param {number} lon1 - Longitude titik 1 (derajat)
 * @param {number} lat2 - Latitude titik 2 (derajat)
 * @param {number} lon2 - Longitude titik 2 (derajat)
 * @returns {number} Jarak dalam kilometer
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
        isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        console.error('❌ calculateDistance: Input tidak valid');
        return null;
    }

    const R = 6371; // Radius bumi dalam kilometer

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
 * @param {number} deviceHeading - Heading perangkat saat ini
 * @param {number} qiblaBearing - Bearing kiblat
 * @returns {number} Sudut rotasi untuk panah (derajat)
 */
export function getArrowRotation(deviceHeading, qiblaBearing) {
    if (deviceHeading === null || qiblaBearing === null ||
        isNaN(deviceHeading) || isNaN(qiblaBearing)) {
        return 0;
    }

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

    const absDiff = Math.abs(angleDifference);
    return absDiff <= threshold;
}

/**
 * 🆕 Mendapatkan panduan arah berdasarkan selisih sudut
 * Memberikan instruksi ke pengguna untuk memutar HP
 * 
 * @param {number} angleDifference - Selisih sudut antara heading dan kiblat
 * @returns {object} Object berisi arah, teks panduan, dan persentase kedekatan
 */
export function getDirectionGuidance(angleDifference) {
    if (angleDifference === null || isNaN(angleDifference)) {
        return {
            direction: null,
            text: 'Menunggu data sensor...',
            percentage: 0,
            severity: 'unknown'
        };
    }

    const absDiff = Math.abs(angleDifference);
    
    // Tentukan arah putaran
    // angleDifference positif = kiblat di sebelah kanan (putar ke kanan)
    // angleDifference negatif = kiblat di sebelah kiri (putar ke kiri)
    const direction = angleDifference > 0 ? 'right' : 'left';
    
    // Tentukan severity dan teks panduan
    let severity, text, icon;
    
    if (absDiff <= 3) {
        severity = 'success';
        text = 'Menghadap Kiblat';
        icon = '🎯';
    } else if (absDiff <= 10) {
        severity = 'info';
        text = 'Geser Sedikit Lagi';
        icon = '🤏';
    } else if (absDiff <= 30) {
        severity = 'info';
        text = 'Putar Perlahan';
        icon = '🔄';
    } else if (absDiff <= 60) {
        severity = 'warning';
        text = 'Putar ke ' + (direction === 'right' ? 'Kanan' : 'Kiri');
        icon = direction === 'right' ? '👉' : '👈';
    } else if (absDiff <= 120) {
        severity = 'warning';
        text = 'Jauh ke ' + (direction === 'right' ? 'Kanan' : 'Kiri');
        icon = direction === 'right' ? '👉' : '👈';
    } else {
        severity = 'secondary';
        text = 'Berputar ke ' + (direction === 'right' ? 'Kanan' : 'Kiri');
        icon = direction === 'right' ? '↪️' : '↩️';
    }
    
    // Hitung persentase kedekatan (100% = menghadap kiblat, 0% = 180 derajat)
    const percentage = Math.max(0, Math.min(100, ((180 - absDiff) / 180) * 100));
    
    return {
        direction,
        text,
        icon,
        severity,
        percentage: Math.round(percentage),
        absDifference: Math.round(absDiff * 10) / 10
    };
}

/**
 * Menghitung semua data kiblat sekaligus
 * @param {number} userLat - Latitude user
 * @param {number} userLon - Longitude user
 * @param {number} deviceHeading - Heading perangkat
 * @returns {object} Object berisi semua informasi kiblat
 */
export function calculateQiblaData(userLat, userLon, deviceHeading) {
    const result = {
        qiblaBearing: null,
        distance: null,
        angleDifference: null,
        arrowRotation: null,
        isFacingQibla: false,
        guidance: null,  // 🆕 Tambahan
        isValid: false,
    };

    if (userLat === null || userLon === null ||
        isNaN(userLat) || isNaN(userLon)) {
        console.warn('⚠️ calculateQiblaData: Posisi user tidak valid');
        return result;
    }

    const qiblaBearing = getQiblaBearing(userLat, userLon);
    if (qiblaBearing === null) {
        console.error('❌ Gagal menghitung bearing kiblat');
        return result;
    }

    const distance = getDistanceToKaabah(userLat, userLon);

    let angleDifference = null;
    let arrowRotation = 0;
    let facingQibla = false;
    let guidance = getDirectionGuidance(null);

    if (deviceHeading !== null && !isNaN(deviceHeading)) {
        angleDifference = getQiblaAngleDifference(deviceHeading, qiblaBearing);
        arrowRotation = getArrowRotation(deviceHeading, qiblaBearing);
        facingQibla = isFacingQibla(angleDifference);
        guidance = getDirectionGuidance(angleDifference);  // 🆕
    }

    result.qiblaBearing = qiblaBearing;
    result.distance = distance;
    result.angleDifference = angleDifference;
    result.arrowRotation = arrowRotation;
    result.isFacingQibla = facingQibla;
    result.guidance = guidance;  // 🆕
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
        guidance: qiblaData.guidance,  // 🆕
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
