/**
 * qibla.js
 * Modul Perhitungan Arah Kiblat - Menghitung bearing/azimuth ke Ka'bah
 * Menggunakan rumus spherical trigonometry (Great Circle Navigation)
 *
 * Rumus yang digunakan: Initial Bearing / Forward Azimuth
 * Formula: θ = atan2(sin(Δλ) ⋅ cos(φ₂), cos(φ₁) ⋅ sin(φ₂) − sin(φ₁) ⋅ cos(φ₂) ⋅ cos(Δλ))
 *
 * Referensi: https://www.movable-type.co.uk/scripts/latlong.html
 */

/**
 * Koordinat Ka'bah (Masjidil Haram, Mekkah, Arab Saudi)
 * Nilai ini adalah konstanta tetap dan tidak berubah
 */
const KAABAH = Object.freeze({
  latitude: 21.4225, // Lintang Ka'bah dalam derajat desimal
  longitude: 39.8262, // Bujur Ka'bah dalam derajat desimal
  description: "Ka'bah, Masjidil Haram, Mekkah",
});

/**
 * Konstanta matematika untuk konversi derajat-radian
 */
const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const FULL_CIRCLE_DEGREES = 360;

/**
 * Mengkonversi sudut dari derajat ke radian
 *
 * @param {number} degrees - Sudut dalam derajat
 * @returns {number} Sudut dalam radian
 */
function toRadians(degrees) {
  return degrees * DEGREES_TO_RADIANS;
}

/**
 * Mengkonversi sudut dari radian ke derajat
 *
 * @param {number} radians - Sudut dalam radian
 * @returns {number} Sudut dalam derajat
 */
function toDegrees(radians) {
  return radians * RADIANS_TO_DEGREES;
}

/**
 * Menormalisasi sudut ke rentang 0° hingga 360°
 * Memastikan tidak ada sudut negatif atau di atas 360°
 *
 * @param {number} degrees - Sudut dalam derajat (bisa negatif atau > 360)
 * @returns {number} Sudut yang sudah dinormalisasi (0-360)
 *
 * @example
 * normalizeDegrees(-45)   // returns 315
 * normalizeDegrees(400)   // returns 40
 * normalizeDegrees(360)   // returns 0
 */
function normalizeDegrees(degrees) {
  // Gunakan modulo untuk mendapatkan rentang (-360, 360)
  let normalized = degrees % FULL_CIRCLE_DEGREES;

  // Jika hasil negatif, tambahkan 360 untuk mendapat nilai positif
  if (normalized < 0) {
    normalized += FULL_CIRCLE_DEGREES;
  }

  return normalized;
}

/**
 * Menghitung arah kiblat (bearing) dari posisi pengguna ke Ka'bah
 * Menggunakan rumus spherical trigonometry Great Circle
 *
 * Formula Initial Bearing:
 * θ = atan2(
 *     sin(Δλ) ⋅ cos(φ₂),
 *     cos(φ₁) ⋅ sin(φ₂) − sin(φ₁) ⋅ cos(φ₂) ⋅ cos(Δλ)
 * )
 *
 * Dimana:
 * - φ₁ = latitude pengguna (radian)
 * - φ₂ = latitude Ka'bah (radian)
 * - λ₁ = longitude pengguna (radian)
 * - λ₂ = longitude Ka'bah (radian)
 * - Δλ = selisih longitude (λ₂ - λ₁) (radian)
 * - θ = bearing dari utara sejati (radian)
 *
 * @param {number} userLatitude - Latitude pengguna dalam derajat desimal
 * @param {number} userLongitude - Longitude pengguna dalam derajat desimal
 *
 * @returns {number} Arah kiblat dalam derajat (0° - 360°)
 * 0° = Utara, 90° = Timur, 180° = Selatan, 270° = Barat
 *
 * @example
 * // Untuk Jakarta (sekitar -6.2, 106.8)
 * const qiblaDirection = calculateQiblaDirection(-6.2, 106.8);
 * console.log(qiblaDirection); // Sekitar 295°
 */
export function calculateQiblaDirection(userLatitude, userLongitude) {
  // Langkah 1: Konversi semua koordinat dari derajat ke radian
  const userLatRad = toRadians(userLatitude); // φ₁ - latitude pengguna
  const userLngRad = toRadians(userLongitude); // λ₁ - longitude pengguna
  const kaabahLatRad = toRadians(KAABAH.latitude); // φ₂ - latitude Ka'bah
  const kaabahLngRad = toRadians(KAABAH.longitude); // λ₂ - longitude Ka'bah

  // Langkah 2: Hitung selisih longitude (Δλ)
  const deltaLongitude = kaabahLngRad - userLngRad; // Δλ = λ₂ - λ₁

  // Langkah 3: Hitung komponen rumus bearing
  // y = sin(Δλ) ⋅ cos(φ₂)
  const y = Math.sin(deltaLongitude) * Math.cos(kaabahLatRad);

  // Langkah 4: Hitung komponen rumus bearing
  // x = cos(φ₁) ⋅ sin(φ₂) − sin(φ₁) ⋅ cos(φ₂) ⋅ cos(Δλ)
  const x =
    Math.cos(userLatRad) * Math.sin(kaabahLatRad) -
    Math.sin(userLatRad) * Math.cos(kaabahLatRad) * Math.cos(deltaLongitude);

  // Langkah 5: Hitung bearing menggunakan atan2(y, x)
  // atan2 memberikan hasil dalam radian dari -π hingga π
  const bearingRadians = Math.atan2(y, x);

  // Langkah 6: Konversi bearing dari radian ke derajat
  const bearingDegrees = toDegrees(bearingRadians);

  // Langkah 7: Normalisasi ke rentang 0° - 360°
  const normalizedBearing = normalizeDegrees(bearingDegrees);

  // Langkah 8: Kembalikan hasil dengan presisi yang tepat
  return normalizedBearing;
}

/**
 * Menghitung arah kiblat dengan presisi tinggi
 * Sama seperti calculateQiblaDirection tapi mengembalikan
 * angka dengan banyak desimal untuk keperluan presisi
 *
 * @param {number} userLatitude - Latitude pengguna
 * @param {number} userLongitude - Longitude pengguna
 * @returns {number} Arah kiblat dengan presisi tinggi
 */
export function calculateQiblaDirectionPrecise(userLatitude, userLongitude) {
  return calculateQiblaDirection(userLatitude, userLongitude);
}

/**
 * Memformat sudut bearing ke string dengan 2 desimal dan simbol derajat
 *
 * @param {number} degrees - Sudut dalam derajat
 * @returns {string} String terformat, contoh: "294.37°"
 *
 * @example
 * formatBearing(294.3712) // returns "294.37°"
 */
export function formatBearing(degrees) {
  return `${degrees.toFixed(2)}°`;
}

/**
 * Mendapatkan arah mata angin terdekat dari bearing
 * Berguna untuk menampilkan arah secara tekstual
 *
 * @param {number} degrees - Sudut bearing dalam derajat (0-360)
 * @returns {string} Arah mata angin terdekat
 *
 * @example
 * getCompassDirection(295) // returns "Barat Laut"
 */
export function getCompassDirection(degrees) {
  const directions = [
    "Utara",
    "Utara Timur Laut",
    "Timur Laut",
    "Timur Timur Laut",
    "Timur",
    "Timur Tenggara",
    "Tenggara",
    "Selatan Tenggara",
    "Selatan",
    "Selatan Barat Daya",
    "Barat Daya",
    "Barat Barat Daya",
    "Barat",
    "Barat Barat Laut",
    "Barat Laut",
    "Utara Barat Laut",
  ];

  // Setiap arah mencakup 22.5 derajat (360 / 16)
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;

  return directions[index];
}

/**
 * Mengekspor koordinat Ka'bah untuk referensi
 * Berguna jika komponen lain perlu mengetahui koordinat Ka'bah
 */
export { KAABAH };
