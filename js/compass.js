/**
 * compass.js
 * Modul Sensor Kompas - Membaca arah hadap perangkat (heading)
 *
 * Kompatibel dengan:
 * - Android Chrome (deviceorientationabsolute / deviceorientation)
 * - Samsung Internet
 * - Microsoft Edge Mobile
 * - Safari iOS (memerlukan requestPermission)
 *
 * Hanya bertugas membaca heading perangkat.
 * Tidak melakukan manipulasi DOM, perhitungan kiblat, atau animasi.
 */

// ==================== KONSTANTA ====================

/**
 * Event yang didukung untuk membaca orientasi perangkat
 * Diurutkan berdasarkan prioritas
 */
const ORIENTATION_EVENTS = {
  ABSOLUTE: "deviceorientationabsolute", // Orientasi absolut (relatif terhadap Bumi) - Preferred
  STANDARD: "deviceorientation", // Orientasi standar (mungkin relatif terhadap layar)
};

/**
 * Batas nilai heading yang valid (dalam derajat)
 */
const HEADING_MIN = 0;
const HEADING_MAX = 360;

// ==================== DETEKSI DUKUNGAN ====================

/**
 * Mengecek apakah browser mendukung Device Orientation API
 *
 * Memeriksa keberadaan event 'deviceorientation' pada window
 *
 * @returns {boolean} true jika Device Orientation API didukung, false jika tidak
 *
 * @example
 * if (isCompassSupported()) {
 *     console.log('Kompas tersedia');
 * }
 */
export function isCompassSupported() {
  // Cek apakah event deviceorientation ada di window
  return "DeviceOrientationEvent" in window;
}

/**
 * Mengecek apakah browser mendukung orientasi absolut (relatif terhadap Bumi)
 *
 * DeviceOrientationAbsoluteEvent memberikan heading yang relatif terhadap
 * Utara Magnetik Bumi, bukan relatif terhadap orientasi layar perangkat.
 *
 * @returns {boolean} true jika orientasi absolut didukung
 */
export function isAbsoluteOrientationSupported() {
  return "DeviceOrientationAbsoluteEvent" in window;
}

// ==================== PERMISSION ====================

/**
 * Meminta izin akses sensor orientasi perangkat
 *
 * Menangani perbedaan antara browser:
 * - Safari iOS 13+: Memerlukan DeviceOrientationEvent.requestPermission()
 * - Android Chrome & lainnya: Tidak memerlukan izin eksplisit untuk sensor
 *
 * @returns {Promise<boolean>}
 * - true: Izin diberikan atau tidak diperlukan
 * - false: Izin ditolak atau tidak tersedia
 *
 * @throws {Error} Jika terjadi kesalahan saat meminta izin
 *
 * @example
 * try {
 *     const granted = await requestCompassPermission();
 *     if (granted) {
 *         startCompass(handleHeading);
 *     }
 * } catch (error) {
 *     console.error('Gagal meminta izin:', error);
 * }
 */
export async function requestCompassPermission() {
  // Langkah 1: Cek apakah Device Orientation didukung
  if (!isCompassSupported()) {
    throw new Error("Device Orientation API tidak didukung oleh browser ini.");
  }

  // Langkah 2: Cek apakah browser memerlukan permission eksplisit (Safari iOS)
  // DeviceOrientationEvent.requestPermission hanya ada di Safari iOS 13+
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      // Meminta izin sensor ke pengguna (Safari iOS)
      const permissionState = await DeviceOrientationEvent.requestPermission();

      // Safari mengembalikan 'granted' atau 'denied'
      if (permissionState === "granted") {
        return true;
      } else {
        // Izin ditolak oleh pengguna
        return false;
      }
    } catch (error) {
      // Error saat meminta izin (misal: pengguna menutup dialog)
      throw new Error(`Gagal meminta izin sensor: ${error.message}`);
    }
  }

  // Langkah 3: Browser lain (Android Chrome, Samsung Internet, Edge)
  // Tidak memerlukan izin eksplisit - langsung kembalikan true
  return true;
}

// ==================== PEMBACAAN HEADING ====================

/**
 * Variabel internal untuk menyimpan referensi event listener
 * Digunakan oleh stopCompass() untuk menghapus listener yang tepat
 */
let activeEventListener = null;
let activeEventType = null;

/**
 * Memulai pembacaan sensor kompas secara realtime
 *
 * Prioritas event:
 * 1. 'deviceorientationabsolute' - Heading absolut terhadap Bumi (lebih akurat)
 * 2. 'deviceorientation' - Heading standar (fallback)
 *
 * @param {Function} callback - Fungsi yang dipanggil setiap kali heading berubah
 * @param {Object} callback.data - Objek data heading
 * @param {number|null} callback.data.heading - Heading perangkat (0-359.99) atau null jika tidak tersedia
 *
 * @throws {Error} Jika kompas tidak didukung
 *
 * @example
 * startCompass((data) => {
 *     if (data.heading !== null) {
 *         console.log(`Menghadap: ${data.heading.toFixed(2)}°`);
 *     } else {
 *         console.log('Heading tidak tersedia');
 *     }
 * });
 */
export function startCompass(callback) {
  // Validasi: pastikan kompas didukung
  if (!isCompassSupported()) {
    throw new Error(
      "Device Orientation API tidak didukung. Tidak dapat memulai kompas.",
    );
  }

  // Validasi: pastikan callback adalah fungsi
  if (typeof callback !== "function") {
    throw new Error("Parameter callback harus berupa fungsi.");
  }

  // Hentikan listener yang sedang berjalan (jika ada)
  // Mencegah duplikasi event listener
  stopCompass();

  /**
   * Handler event deviceorientationabsolute
   * Event ini memberikan orientasi absolut terhadap Bumi
   *
   * @param {DeviceOrientationEvent} event - Event orientasi dari browser
   */
  function handleAbsoluteOrientation(event) {
    const heading = extractHeading(event, true);
    callback({ heading });
  }

  /**
   * Handler event deviceorientation (standar)
   * Fallback jika orientasi absolut tidak tersedia
   *
   * @param {DeviceOrientationEvent} event - Event orientasi dari browser
   */
  function handleStandardOrientation(event) {
    const heading = extractHeading(event, false);
    callback({ heading });
  }

  // Langkah 1: Coba gunakan orientasi absolut terlebih dahulu
  if (isAbsoluteOrientationSupported()) {
    window.addEventListener(
      ORIENTATION_EVENTS.ABSOLUTE,
      handleAbsoluteOrientation,
    );
    activeEventListener = handleAbsoluteOrientation;
    activeEventType = ORIENTATION_EVENTS.ABSOLUTE;
  } else {
    // Langkah 2: Fallback ke orientasi standar
    window.addEventListener(
      ORIENTATION_EVENTS.STANDARD,
      handleStandardOrientation,
    );
    activeEventListener = handleStandardOrientation;
    activeEventType = ORIENTATION_EVENTS.STANDARD;
  }
}

/**
 * Menghentikan pembacaan sensor kompas
 *
 * Menghapus event listener yang sedang aktif untuk menghemat baterai
 * dan menghentikan pembaruan heading yang tidak diperlukan.
 *
 * Aman dipanggil meskipun kompas belum dimulai (tidak menyebabkan error).
 *
 * @example
 * stopCompass(); // Hentikan pembacaan kompas
 */
export function stopCompass() {
  if (activeEventListener && activeEventType) {
    window.removeEventListener(activeEventType, activeEventListener);

    // Reset referensi
    activeEventListener = null;
    activeEventType = null;
  }
}

// ==================== EKSTRAKSI HEADING ====================

/**
 * Mengekstrak nilai heading dari event DeviceOrientation
 *
 * Menangani perbedaan implementasi antar browser:
 * - Android Chrome: Menggunakan event.alpha atau event.webkitCompassHeading
 * - Safari iOS: Menggunakan event.webkitCompassHeading (tersedia di iOS)
 * - Browser lain: Menggunakan event.alpha (0-360, tapi mungkin berbeda orientasi)
 *
 * @param {DeviceOrientationEvent} event - Event orientasi dari browser
 * @param {boolean} isAbsolute - Apakah event berasal dari orientasi absolut
 * @returns {number|null} Heading dalam derajat (0-359.99) atau null jika tidak tersedia
 */
function extractHeading(event, isAbsolute = false) {
  // Coba ambil heading dari berbagai properti yang tersedia

  // Prioritas 1: webkitCompassHeading (tersedia di Safari iOS dan beberapa browser)
  // Nilai ini sudah benar: 0 = Utara, 90 = Timur, 180 = Selatan, 270 = Barat
  if (
    event.webkitCompassHeading != null &&
    !isNaN(event.webkitCompassHeading)
  ) {
    return normalizeHeading(event.webkitCompassHeading);
  }

  // Prioritas 2: event.alpha (standar W3C)
  // Catatan: Pada deviceorientation biasa, alpha dihitung relatif terhadap
  // orientasi awal perangkat, dan arah putarannya BERLAWANAN dengan arah
  // kompas (alpha bertambah berlawanan arah jarum jam, sedangkan heading
  // kompas bertambah searah jarum jam). Pada deviceorientationabsolute,
  // alpha = 0 sudah berarti Utara searah jarum jam, jadi tidak perlu dibalik.
  if (event.alpha != null && !isNaN(event.alpha)) {
    if (isAbsolute) {
      // Orientasi absolut: 0 = Utara, nilai bertambah searah jarum jam
      return normalizeHeading(event.alpha);
    } else {
      // Orientasi standar: konversi ke heading kompas dengan membalik arah
      return normalizeHeading(360 - event.alpha);
    }
  }

  // Heading tidak tersedia dari properti manapun
  return null;
}

/**
 * Menormalisasi nilai heading ke rentang 0° - 359.99°
 *
 * Memastikan heading selalu dalam rentang yang valid:
 * - Nilai negatif dikonversi ke positif
 * - Nilai >= 360 dikurangi modulo
 * - Nilai 360 diubah menjadi 0 (karena 360° = 0°)
 *
 * @param {number} heading - Nilai heading mentah (dalam derajat)
 * @returns {number} Heading yang sudah dinormalisasi (0-359.99)
 *
 * @example
 * normalizeHeading(-45)  // returns 315
 * normalizeHeading(400)  // returns 40
 * normalizeHeading(360)  // returns 0
 * normalizeHeading(0)    // returns 0
 */
function normalizeHeading(heading) {
  // Pastikan heading adalah angka
  if (typeof heading !== "number" || isNaN(heading)) {
    return 0;
  }

  // Gunakan modulo untuk mendapatkan nilai dalam rentang [0, 360)
  let normalized = heading % HEADING_MAX;

  // Jika hasil negatif, tambahkan 360 untuk mendapatkan nilai positif
  if (normalized < HEADING_MIN) {
    normalized += HEADING_MAX;
  }

  // Bulatkan ke 2 desimal untuk konsistensi
  return Math.round(normalized * 100) / 100;
}

// ==================== FUNGSI TAMBAHAN ====================

/**
 * Mendapatkan status kompas saat ini
 * Berguna untuk debugging atau menampilkan status ke pengguna
 *
 * @returns {Object} Status kompas
 * @returns {boolean} status.supported - Apakah kompas didukung
 * @returns {boolean} status.absoluteSupported - Apakah orientasi absolut didukung
 * @returns {boolean} status.isActive - Apakah kompas sedang aktif
 * @returns {string|null} status.activeEventType - Jenis event yang sedang digunakan
 */
export function getCompassStatus() {
  return {
    supported: isCompassSupported(),
    absoluteSupported: isAbsoluteOrientationSupported(),
    isActive: activeEventListener !== null,
    activeEventType: activeEventType,
  };
}
