/**
 * app.js
 * File utama aplikasi Kiblat Finder
 * Menghubungkan location.js dan qibla.js dengan tampilan HTML
 *
 * Bertanggung jawab untuk:
 * - Menangani interaksi pengguna (klik tombol)
 * - Mengelola alur pengambilan lokasi → perhitungan kiblat → update UI
 * - Menampilkan status dan pesan ke pengguna
 */

// Import modul eksternal
import {
  getUserPosition,
  isGeolocationSupported,
  GeolocationErrorType,
  checkLocationPermission,
} from "./location.js";
import { calculateQiblaDirection, formatBearing } from "./qibla.js";

// ==================== KONSTANTA ====================

/**
 * Status tampilan untuk badge sensor
 */
const SENSOR_STATUS = {
  READY: "ready", // Siap digunakan
  LOADING: "loading", // Sedang memproses
  ACTIVE: "active", // GPS aktif dan berhasil
  ERROR: "error", // Terjadi kesalahan
};

/**
 * Status tampilan untuk placeholder lokasi
 */
const LOCATION_STATUS = {
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};

// ==================== DOM ELEMENTS ====================

/**
 * Cache semua referensi elemen DOM yang dibutuhkan
 * Dilakukan sekali saat inisialisasi untuk performa
 */
const DOM = {
  allowLocationBtn: document.getElementById("allowLocationBtn"),
  locationPlaceholder: document.getElementById("locationPlaceholder"),
  latitudeValue: document.getElementById("latitudeValue"),
  longitudeValue: document.getElementById("longitudeValue"),
  sensorBadge: document.getElementById("sensorBadge"),
  kiblatDegree: document.getElementById("kiblatDegree"),
  kiblatArrow: document.getElementById("kiblatArrow"),
};

// ==================== UI HELPER FUNCTIONS ====================

/**
 * Memperbarui tampilan placeholder lokasi
 *
 * @param {string} text - Teks yang akan ditampilkan
 * @param {string} status - Status: 'loading', 'success', atau 'error'
 */
function updateLocationPlaceholder(text, status = LOCATION_STATUS.LOADING) {
  if (!DOM.locationPlaceholder) return;

  // Update teks
  DOM.locationPlaceholder.textContent = text;

  // Reset class CSS
  DOM.locationPlaceholder.classList.remove(
    "text-success",
    "text-error",
    "text-loading",
  );

  // Tambahkan class sesuai status untuk styling
  switch (status) {
    case LOCATION_STATUS.SUCCESS:
      DOM.locationPlaceholder.classList.add("text-success");
      break;
    case LOCATION_STATUS.ERROR:
      DOM.locationPlaceholder.classList.add("text-error");
      break;
    case LOCATION_STATUS.LOADING:
      DOM.locationPlaceholder.classList.add("text-loading");
      break;
  }
}

/**
 * Memperbarui tampilan badge sensor
 *
 * @param {string} text - Teks yang ditampilkan di badge
 * @param {string} status - Status: 'ready', 'loading', 'active', atau 'error'
 */
function updateSensorBadge(text, status = SENSOR_STATUS.READY) {
  if (!DOM.sensorBadge) return;

  // Update teks badge (mempertahankan dot indikator)
  const badgeDot = DOM.sensorBadge.querySelector(".badge-dot");

  // Hapus text node yang ada dan tambahkan yang baru
  // Mempertahankan elemen dot di posisi pertama
  while (DOM.sensorBadge.childNodes.length > 1) {
    DOM.sensorBadge.removeChild(DOM.sensorBadge.lastChild);
  }
  DOM.sensorBadge.appendChild(document.createTextNode(` ${text}`));

  // Update class status untuk styling CSS
  DOM.sensorBadge.classList.remove("ready", "loading", "active", "error");
  DOM.sensorBadge.classList.add(status);

  // Update warna dot indikator
  if (badgeDot) {
    switch (status) {
      case SENSOR_STATUS.ACTIVE:
        badgeDot.style.backgroundColor = "#4ade80";
        badgeDot.style.boxShadow = "0 0 8px #4ade80";
        break;
      case SENSOR_STATUS.ERROR:
        badgeDot.style.backgroundColor = "#f87171";
        badgeDot.style.boxShadow = "0 0 8px #f87171";
        break;
      case SENSOR_STATUS.LOADING:
        badgeDot.style.backgroundColor = "#fbbf24";
        badgeDot.style.boxShadow = "0 0 8px #fbbf24";
        break;
      default: // ready
        badgeDot.style.backgroundColor = "#a7f3d0";
        badgeDot.style.boxShadow = "0 0 8px #6ee7b7";
        break;
    }
  }
}

/**
 * Memperbarui tampilan koordinat (latitude dan longitude)
 *
 * @param {number|null} latitude - Nilai latitude atau null untuk reset
 * @param {number|null} longitude - Nilai longitude atau null untuk reset
 */
function updateCoordinates(latitude, longitude) {
  if (DOM.latitudeValue) {
    DOM.latitudeValue.textContent =
      latitude !== null ? latitude.toFixed(6) : "-";
  }

  if (DOM.longitudeValue) {
    DOM.longitudeValue.textContent =
      longitude !== null ? longitude.toFixed(6) : "-";
  }
}

/**
 * Memperbarui tampilan arah kiblat
 *
 * @param {number|null} degrees - Arah kiblat dalam derajat atau null untuk reset
 */
function updateQiblaDirection(degrees) {
  if (!DOM.kiblatDegree) return;

  if (degrees !== null && !isNaN(degrees)) {
    DOM.kiblatDegree.textContent = formatBearing(degrees);
  } else {
    DOM.kiblatDegree.textContent = "0°";
  }
}

/**
 * Mereset seluruh tampilan ke kondisi awal
 */
function resetUI() {
  updateLocationPlaceholder("Mendeteksi lokasi...", LOCATION_STATUS.LOADING);
  updateSensorBadge("Siap", SENSOR_STATUS.READY);
  updateCoordinates(null, null);
  updateQiblaDirection(null);
}

/**
 * Mengatur tampilan ke mode loading
 */
function setLoadingState() {
  updateLocationPlaceholder("Mendeteksi lokasi...", LOCATION_STATUS.LOADING);
  updateSensorBadge("Mendeteksi...", SENSOR_STATUS.LOADING);
}

/**
 * Mengatur tampilan saat berhasil mendapatkan lokasi dan menghitung kiblat
 *
 * @param {number} latitude - Latitude pengguna
 * @param {number} longitude - Longitude pengguna
 * @param {number} qiblaDirection - Arah kiblat dalam derajat
 */
function setSuccessState(latitude, longitude, qiblaDirection) {
  updateCoordinates(latitude, longitude);
  updateQiblaDirection(qiblaDirection);
  updateLocationPlaceholder(
    "Lokasi berhasil diperoleh",
    LOCATION_STATUS.SUCCESS,
  );
  updateSensorBadge("GPS Aktif", SENSOR_STATUS.ACTIVE);
}

/**
 * Mengatur tampilan saat terjadi error
 *
 * @param {string} errorMessage - Pesan error untuk ditampilkan
 */
function setErrorState(errorMessage) {
  updateLocationPlaceholder(errorMessage, LOCATION_STATUS.ERROR);
  updateSensorBadge("Error", SENSOR_STATUS.ERROR);
  updateCoordinates(null, null);
  updateQiblaDirection(null);
}

// ==================== MAIN APPLICATION LOGIC ====================

/**
 * Memproses permintaan lokasi dan menghitung arah kiblat
 * Ini adalah fungsi utama yang menangani seluruh alur kerja:
 * 1. Validasi dukungan browser
 * 2. Ambil lokasi pengguna
 * 3. Hitung arah kiblat
 * 4. Perbarui tampilan
 */
async function handleFindQibla() {
  // Langkah 1: Validasi dukungan Geolocation API
  if (!isGeolocationSupported()) {
    setErrorState("Browser tidak mendukung GPS");
    return;
  }

  // Langkah 2: Cek status izin lokasi
  const permissionStatus = await checkLocationPermission();

  if (permissionStatus === "denied") {
    setErrorState(
      "Izin lokasi telah diblokir. Silakan periksa pengaturan browser Anda.",
    );
    return;
  }

  // Langkah 3: Set UI ke mode loading
  setLoadingState();

  try {
    // Langkah 4: Ambil posisi pengguna dari Geolocation API
    const position = await getUserPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    const { latitude, longitude } = position;

    // Langkah 5: Hitung arah kiblat berdasarkan koordinat
    const qiblaDirection = calculateQiblaDirection(latitude, longitude);

    // Langkah 6: Tampilkan hasil ke UI
    setSuccessState(latitude, longitude, qiblaDirection);

    // Log untuk debugging
    console.log("📍 Lokasi berhasil diperoleh:", { latitude, longitude });
    console.log("🕋 Arah Kiblat:", formatBearing(qiblaDirection));
  } catch (error) {
    // Langkah 7: Tangani berbagai jenis error
    console.error("❌ Gagal mendapatkan lokasi:", error);

    let errorMessage;

    switch (error.type) {
      case GeolocationErrorType.PERMISSION_DENIED:
        errorMessage = "Izin lokasi ditolak";
        break;

      case GeolocationErrorType.POSITION_UNAVAILABLE:
        errorMessage = "Lokasi tidak tersedia";
        break;

      case GeolocationErrorType.TIMEOUT:
        errorMessage = "Waktu permintaan habis. Coba lagi.";
        break;

      case GeolocationErrorType.UNSUPPORTED:
        errorMessage = "Browser tidak mendukung GPS";
        break;

      case GeolocationErrorType.INVALID_DATA:
        errorMessage = "Data lokasi tidak valid";
        break;

      default:
        errorMessage = error.message || "Gagal mendapatkan lokasi";
        break;
    }

    setErrorState(errorMessage);
  }
}

/**
 * Mengaktifkan/menonaktifkan tombol
 * Mencegah double-click saat proses berlangsung
 *
 * @param {boolean} disabled - true untuk menonaktifkan, false untuk mengaktifkan
 */
function setButtonDisabled(disabled) {
  if (!DOM.allowLocationBtn) return;

  DOM.allowLocationBtn.disabled = disabled;

  if (disabled) {
    DOM.allowLocationBtn.style.opacity = "0.7";
    DOM.allowLocationBtn.style.cursor = "not-allowed";
  } else {
    DOM.allowLocationBtn.style.opacity = "1";
    DOM.allowLocationBtn.style.cursor = "pointer";
  }
}

/**
 * Handler untuk klik tombol dengan debounce sederhana
 * Mencegah multiple request dalam waktu bersamaan
 */
let isProcessing = false;

async function onFindQiblaClick() {
  // Cegah double-click
  if (isProcessing) return;

  isProcessing = true;
  setButtonDisabled(true);

  try {
    await handleFindQibla();
  } finally {
    // Selalu kembalikan state tombol setelah selesai
    isProcessing = false;
    setButtonDisabled(false);
  }
}

// ==================== INITIALIZATION ====================

/**
 * Mengecek status awal saat halaman dimuat
 * Memberikan informasi awal kepada pengguna tentang status izin
 */
async function initializeApp() {
  // Pastikan semua elemen DOM tersedia
  if (!DOM.allowLocationBtn) {
    console.error("❌ Elemen allowLocationBtn tidak ditemukan di HTML");
    return;
  }

  // Tambahkan event listener ke tombol
  DOM.allowLocationBtn.addEventListener("click", onFindQiblaClick);

  // Set tampilan awal
  resetUI();

  // Cek izin awal untuk memberikan feedback yang tepat
  if (!isGeolocationSupported()) {
    setErrorState("Browser tidak mendukung GPS");
    setButtonDisabled(true);
    return;
  }

  const permissionStatus = await checkLocationPermission();

  switch (permissionStatus) {
    case "granted":
      // Izin sudah diberikan, beri tahu pengguna
      updateLocationPlaceholder(
        "Izin lokasi sudah diberikan. Klik tombol untuk mulai.",
        LOCATION_STATUS.SUCCESS,
      );
      updateSensorBadge("Siap", SENSOR_STATUS.READY);
      break;

    case "denied":
      // Izin sudah diblokir
      updateLocationPlaceholder(
        "Izin lokasi diblokir. Periksa pengaturan browser.",
        LOCATION_STATUS.ERROR,
      );
      updateSensorBadge("Diblokir", SENSOR_STATUS.ERROR);
      break;

    case "prompt":
      // Izin belum diminta
      updateLocationPlaceholder(
        "Klik tombol untuk mengizinkan akses lokasi",
        LOCATION_STATUS.LOADING,
      );
      updateSensorBadge("Siap", SENSOR_STATUS.READY);
      break;

    default:
      // Permissions API tidak didukung
      updateLocationPlaceholder(
        "Klik tombol untuk memulai",
        LOCATION_STATUS.LOADING,
      );
      updateSensorBadge("Siap", SENSOR_STATUS.READY);
      break;
  }

  console.log("🕌 Kiblat Finder siap digunakan");
}

// ==================== START APPLICATION ====================

// Jalankan inisialisasi setelah DOM selesai dimuat
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOM sudah siap
  initializeApp();
}

// Ekspor untuk kemungkinan penggunaan di modul lain
export { handleFindQibla, resetUI };
