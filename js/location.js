/**
 * location.js
 * Modul Geolocation API - Menangani pengambilan lokasi pengguna
 * Hanya bertugas mengambil data koordinat, tidak melakukan manipulasi DOM
 */

/**
 * Konstanta konfigurasi geolocation
 */
const GEOLOCATION_DEFAULTS = {
  enableHighAccuracy: true, // Akurasi tinggi (menggunakan GPS jika tersedia)
  timeout: 15000, // Waktu maksimum menunggu respon (15 detik)
  maximumAge: 0, // Tidak menggunakan cache, selalu data terbaru
};

/**
 * Tipe error yang mungkin terjadi saat geolocation
 */
export const GeolocationErrorType = {
  UNSUPPORTED: "UNSUPPORTED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  POSITION_UNAVAILABLE: "POSITION_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  INVALID_DATA: "INVALID_DATA",
  UNKNOWN: "UNKNOWN",
};

/**
 * Mengecek apakah browser mendukung Geolocation API
 *
 * @returns {boolean} true jika browser mendukung geolocation, false jika tidak
 */
export function isGeolocationSupported() {
  return "geolocation" in navigator;
}

/**
 * Mengambil posisi pengguna menggunakan Geolocation API
 * Mengembalikan Promise yang akan resolve dengan data koordinat
 * atau reject dengan objek error yang terstruktur
 *
 * @param {Object} [options] - Opsi konfigurasi geolocation (opsional)
 * @param {boolean} [options.enableHighAccuracy=true] - Mengaktifkan mode akurasi tinggi
 * @param {number} [options.timeout=15000] - Batas waktu maksimum dalam milidetik
 * @param {number} [options.maximumAge=0] - Usia maksimum cache posisi dalam milidetik
 *
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number}>}
 * Object berisi latitude, longitude, accuracy (meter), dan timestamp
 *
 * @throws {Object} Object error dengan properti type dan message
 *
 * @example
 * try {
 *     const position = await getUserPosition();
 *     console.log(position.latitude, position.longitude);
 * } catch (error) {
 *     console.error(error.type, error.message);
 * }
 */
export function getUserPosition(options = {}) {
  // Merge opsi pengguna dengan default
  const geolocationOptions = {
    enableHighAccuracy:
      options.enableHighAccuracy ?? GEOLOCATION_DEFAULTS.enableHighAccuracy,
    timeout: options.timeout ?? GEOLOCATION_DEFAULTS.timeout,
    maximumAge: options.maximumAge ?? GEOLOCATION_DEFAULTS.maximumAge,
  };

  return new Promise((resolve, reject) => {
    // Langkah 1: Validasi dukungan browser
    if (!isGeolocationSupported()) {
      reject({
        type: GeolocationErrorType.UNSUPPORTED,
        message:
          "Browser Anda tidak mendukung Geolocation API. Silakan gunakan browser modern seperti Chrome, Firefox, atau Safari.",
      });
      return;
    }

    /**
     * Callback ketika berhasil mendapatkan posisi
     *
     * @param {GeolocationPosition} position - Objek posisi dari browser API
     */
    function handleSuccess(position) {
      const { latitude, longitude, accuracy } = position.coords;

      // Validasi: pastikan koordinat adalah angka yang valid
      if (
        latitude == null ||
        longitude == null ||
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        reject({
          type: GeolocationErrorType.INVALID_DATA,
          message: "Data lokasi yang diterima tidak valid. Silakan coba lagi.",
        });
        return;
      }

      // Kembalikan data lokasi yang sudah tervalidasi
      resolve({
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        timestamp: position.timestamp ?? Date.now(),
      });
    }

    /**
     * Callback ketika terjadi error
     * Memetakan kode error browser ke format error terstruktur
     *
     * @param {GeolocationPositionError} error - Objek error dari browser
     */
    function handleError(error) {
      let errorType;
      let errorMessage;

      switch (error.code) {
        case error.PERMISSION_DENIED: // Kode 1
          errorType = GeolocationErrorType.PERMISSION_DENIED;
          errorMessage =
            "Izin lokasi ditolak. Silakan izinkan akses lokasi di pengaturan browser Anda.";
          break;

        case error.POSITION_UNAVAILABLE: // Kode 2
          errorType = GeolocationErrorType.POSITION_UNAVAILABLE;
          errorMessage =
            "Informasi lokasi tidak tersedia. Periksa koneksi internet atau sinyal GPS Anda.";
          break;

        case error.TIMEOUT: // Kode 3
          errorType = GeolocationErrorType.TIMEOUT;
          errorMessage =
            "Waktu permintaan lokasi habis. Pastikan GPS aktif dan sinyal cukup kuat.";
          break;

        default:
          errorType = GeolocationErrorType.UNKNOWN;
          errorMessage =
            error.message ||
            "Terjadi kesalahan yang tidak diketahui saat mengambil lokasi.";
          break;
      }

      reject({
        type: errorType,
        message: errorMessage,
        originalError: error,
      });
    }

    // Memulai permintaan lokasi ke browser
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      geolocationOptions,
    );
  });
}

/**
 * Mengecek status izin lokasi menggunakan Permissions API
 * Berguna untuk mengetahui apakah pengguna sudah memberikan izin sebelumnya
 *
 * @returns {Promise<string>}
 * - 'granted': Izin sudah diberikan
 * - 'denied': Izin telah ditolak/diblokir
 * - 'prompt': Pengguna akan diminta izin
 * - 'unsupported': Permissions API tidak didukung browser
 */
export async function checkLocationPermission() {
  // Cek ketersediaan Permissions API
  if (!navigator.permissions) {
    return "unsupported";
  }

  try {
    const permissionStatus = await navigator.permissions.query({
      name: "geolocation",
    });
    return permissionStatus.state; // 'granted', 'denied', atau 'prompt'
  } catch (error) {
    // Beberapa browser tidak mendukung query permission geolocation
    return "unsupported";
  }
}
