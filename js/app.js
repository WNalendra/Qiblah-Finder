/**
 * app.js
 * Aplikasi Utama Kiblat Finder
 *
 * Arsitektur:
 * - UI Helpers: Semua manipulasi DOM terisolasi di sini
 * - Business Logic: Alur utama aplikasi (GPS → Kiblat → Kompas)
 * - Initialization: Setup event listener dan state awal
 *
 * Menggunakan ES Modules untuk menghubungkan:
 * - location.js (Geolocation API)
 * - qibla.js (Perhitungan arah kiblat)
 * - compass.js (Sensor kompas perangkat)
 */

// ==================== IMPORTS ====================

import {
  getUserPosition,
  isGeolocationSupported,
  checkLocationPermission,
  GeolocationErrorType,
} from "./location.js";

import { calculateQiblaDirection, formatBearing } from "./qibla.js";

import {
  requestCompassPermission,
  startCompass,
  stopCompass,
} from "./compass.js";

// ==================== KONSTANTA ====================

/**
 * Status badge sensor
 */
const BADGE_STATUS = {
  READY: "ready",
  LOADING: "loading",
  ACTIVE: "active",
  ERROR: "error",
  CALIBRATING: "calibrating",
};

/**
 * Status placeholder lokasi
 */
const LOCATION_STATUS = {
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};

/**
 * Konfigurasi transisi panah kompas
 * CSS transition untuk pergerakan yang halus
 */
const ARROW_TRANSITION = "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

/**
 * Toleransi selisih sudut (dalam derajat) agar dianggap "Tepat" menghadap kiblat
 */
const QIBLA_TOLERANCE = 5;

/**
 * Status indikator kesejajaran kiblat
 */
const QIBLA_STATUS = {
  ALIGNED: "aligned",
  NOT_ALIGNED: "not-aligned",
};

// ==================== DOM REFERENCES ====================

/**
 * Semua referensi elemen DOM yang dibutuhkan
 * Diinisialisasi sekali saat aplikasi dimulai
 */
const DOM = {
  allowLocationBtn: document.getElementById("allowLocationBtn"),
  locationPlaceholder: document.getElementById("locationPlaceholder"),
  latitudeValue: document.getElementById("latitudeValue"),
  longitudeValue: document.getElementById("longitudeValue"),
  sensorBadge: document.getElementById("sensorBadge"),
  kiblatDegree: document.getElementById("kiblatDegree"),
  kiblatArrow: document.getElementById("kiblatArrow"),
  qiblaStatus: document.getElementById("qiblaStatus"),
};

// ==================== STATE MANAGEMENT ====================

/**
 * State aplikasi global
 * Melacak status terkini dari seluruh sistem
 */
const AppState = {
  isProcessing: false, // Mencegah double-click
  qiblaDirection: null, // Arah kiblat terhitung (derajat)
  currentHeading: null, // Heading perangkat saat ini
  isCompassActive: false, // Apakah kompas sedang berjalan
  compassPermissionGranted: false, // Status izin kompas
};

// ==================== UI HELPERS ====================

/**
 * Memperbarui teks dan status placeholder lokasi
 *
 * @param {string} text - Teks yang ditampilkan
 * @param {string} status - Status visual ('loading', 'success', 'error')
 */
function updateLocationPlaceholder(text, status = LOCATION_STATUS.LOADING) {
  if (!DOM.locationPlaceholder) return;

  DOM.locationPlaceholder.textContent = text;

  // Reset kelas status
  DOM.locationPlaceholder.classList.remove(
    "text-success",
    "text-error",
    "text-loading",
  );

  // Terapkan kelas sesuai status
  switch (status) {
    case LOCATION_STATUS.SUCCESS:
      DOM.locationPlaceholder.classList.add("text-success");
      break;
    case LOCATION_STATUS.ERROR:
      DOM.locationPlaceholder.classList.add("text-error");
      break;
    case LOCATION_STATUS.LOADING:
    default:
      DOM.locationPlaceholder.classList.add("text-loading");
      break;
  }
}

/**
 * Memperbarui badge status sensor
 * Menangani teks dan indikator warna dot
 *
 * @param {string} text - Teks badge
 * @param {string} status - Status ('ready', 'loading', 'active', 'error', 'calibrating')
 */
function updateSensorBadge(text, status = BADGE_STATUS.READY) {
  if (!DOM.sensorBadge) return;

  // Ambil elemen dot indikator
  const badgeDot = DOM.sensorBadge.querySelector(".badge-dot");

  // Hapus text nodes yang ada (pertahankan dot)
  while (DOM.sensorBadge.childNodes.length > 1) {
    DOM.sensorBadge.removeChild(DOM.sensorBadge.lastChild);
  }

  // Tambahkan teks baru
  DOM.sensorBadge.appendChild(document.createTextNode(` ${text}`));

  // Reset dan terapkan kelas status
  DOM.sensorBadge.classList.remove(
    "ready",
    "loading",
    "active",
    "error",
    "calibrating",
  );
  DOM.sensorBadge.classList.add(status);

  // Update warna dot indikator
  if (badgeDot) {
    const dotStyles = {
      [BADGE_STATUS.ACTIVE]: { bg: "#4ade80", shadow: "0 0 8px #4ade80" },
      [BADGE_STATUS.ERROR]: { bg: "#f87171", shadow: "0 0 8px #f87171" },
      [BADGE_STATUS.LOADING]: { bg: "#fbbf24", shadow: "0 0 8px #fbbf24" },
      [BADGE_STATUS.CALIBRATING]: { bg: "#fbbf24", shadow: "0 0 8px #fbbf24" },
      [BADGE_STATUS.READY]: { bg: "#a7f3d0", shadow: "0 0 8px #6ee7b7" },
    };

    const style = dotStyles[status] || dotStyles[BADGE_STATUS.READY];
    badgeDot.style.backgroundColor = style.bg;
    badgeDot.style.boxShadow = style.shadow;
  }
}

/**
 * Memperbarui tampilan koordinat latitude dan longitude
 *
 * @param {number|null} latitude - Latitude dalam derajat desimal
 * @param {number|null} longitude - Longitude dalam derajat desimal
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
 * Memperbarui tampilan derajat arah kiblat
 *
 * @param {number|null} degrees - Arah kiblat dalam derajat
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
 * Memutar panah kompas ke sudut tertentu
 * Menggunakan CSS transform dengan transisi halus
 *
 * @param {number} rotation - Sudut rotasi dalam derajat
 */
function updateCompassArrow(rotation) {
  if (!DOM.kiblatArrow) return;

  // Terapkan transisi halus
  DOM.kiblatArrow.style.transition = ARROW_TRANSITION;

  // Rotasi panah menggunakan CSS transform
  DOM.kiblatArrow.style.transform = `translate(-50%, 0%) rotate(${rotation}deg)`;
}

/**
 * Memperbarui indikator status kesejajaran kiblat
 * Hanya bertugas mengubah tulisan dan warna (class) status.
 * Tidak melakukan perhitungan sudut apa pun di sini.
 *
 * @param {boolean|null} isAligned - true jika sudah tepat menghadap kiblat,
 *                                    false jika belum, null jika data belum tersedia
 */
function updateQiblaStatus(isAligned) {
  if (!DOM.qiblaStatus) return;

  // Reset kelas status sebelumnya
  DOM.qiblaStatus.classList.remove(
    QIBLA_STATUS.ALIGNED,
    QIBLA_STATUS.NOT_ALIGNED,
  );

  if (isAligned === null) {
    DOM.qiblaStatus.textContent = "";
    return;
  }

  if (isAligned) {
    DOM.qiblaStatus.textContent = "🟢 Tepat";
    DOM.qiblaStatus.classList.add(QIBLA_STATUS.ALIGNED);
  } else {
    DOM.qiblaStatus.textContent = "🔴 Belum Menghadap Kiblat";
    DOM.qiblaStatus.classList.add(QIBLA_STATUS.NOT_ALIGNED);
  }
}

/**
 * Mereset seluruh UI ke kondisi awal
 */
function resetUI() {
  updateLocationPlaceholder("Mendeteksi lokasi...", LOCATION_STATUS.LOADING);
  updateSensorBadge("Siap", BADGE_STATUS.READY);
  updateCoordinates(null, null);
  updateQiblaDirection(null);
  updateCompassArrow(0);
  updateQiblaStatus(null);
}

/**
 * Mengatur UI ke mode loading
 */
function setLoadingState() {
  updateLocationPlaceholder("Mendeteksi lokasi...", LOCATION_STATUS.LOADING);
  updateSensorBadge("Mendeteksi...", BADGE_STATUS.LOADING);
}

/**
 * Mengatur UI saat berhasil mendapatkan lokasi dan kiblat
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
  updateSensorBadge("GPS Aktif", BADGE_STATUS.ACTIVE);
}

/**
 * Mengatur UI saat terjadi error
 *
 * @param {string} errorMessage - Pesan error untuk pengguna
 */
function setErrorState(errorMessage) {
  updateLocationPlaceholder(errorMessage, LOCATION_STATUS.ERROR);
  updateSensorBadge("Error", BADGE_STATUS.ERROR);
  updateCoordinates(null, null);
  updateQiblaDirection(null);
  updateCompassArrow(0);
  updateQiblaStatus(null);
}

// ==================== BUSINESS LOGIC ====================

/**
 * Menghitung rotasi yang diperlukan agar panah menunjuk ke kiblat
 *
 * Formula:
 * rotation = qiblaDirection - heading
 *
 * Jika pengguna menghadap Utara (heading = 0) dan kiblat di 295°,
 * panah harus berputar 295°.
 *
 * Jika pengguna menghadap Timur (heading = 90) dan kiblat di 295°,
 * panah harus berputar 205° (295 - 90).
 *
 * Hasil dinormalisasi ke rentang yang valid untuk rotasi CSS.
 *
 * @param {number} qiblaDirection - Arah kiblat dalam derajat (0-360)
 * @param {number} heading - Arah hadap perangkat dalam derajat (0-360)
 * @returns {number} Sudut rotasi dalam derajat
 */
function calculateArrowRotation(qiblaDirection, heading) {
  // Hitung selisih antara arah kiblat dan heading perangkat
  let rotation = qiblaDirection - heading;

  // Normalisasi ke rentang -180 hingga 180 untuk rotasi terpendek
  // CSS transform rotate dapat menangani nilai berapa pun,
  // tapi normalisasi membuat animasi lebih halus
  if (rotation > 180) {
    rotation -= 360;
  } else if (rotation < -180) {
    rotation += 360;
  }

  return rotation;
}

/**
 * Menghitung selisih sudut terkecil (minimum) antara dua sudut
 * Sudut bersifat melingkar (0°-360°), sehingga selisih dihitung
 * dengan mempertimbangkan jarak terpendek melintasi titik 0°/360°.
 *
 * Formula:
 * diff = |a - b| % 360
 * hasil = diff > 180 ? 360 - diff : diff
 *
 * @example
 * getAngleDifference(359, 2)  // returns 3, bukan 357
 * getAngleDifference(10, 350) // returns 20
 *
 * @param {number} angleA - Sudut pertama dalam derajat (0-360)
 * @param {number} angleB - Sudut kedua dalam derajat (0-360)
 * @returns {number} Selisih sudut terkecil dalam derajat (0-180)
 */
function getAngleDifference(angleA, angleB) {
  const rawDifference = Math.abs(angleA - angleB) % 360;
  return rawDifference > 180 ? 360 - rawDifference : rawDifference;
}

/**
 * Handler untuk data heading dari kompas
 * Dipanggil setiap kali sensor kompas memberikan data baru
 *
 * @param {Object} data - Data dari compass.js
 * @param {number|null} data.heading - Heading perangkat (0-360) atau null
 */
function handleCompassData(data) {
  // Simpan heading terbaru ke state
  AppState.currentHeading = data.heading;

  // Jika heading tidak tersedia
  if (data.heading === null) {
    // Heading null berarti sensor belum siap atau perlu kalibrasi
    updateSensorBadge("Kalibrasi Kompas", BADGE_STATUS.CALIBRATING);
    return;
  }

  // Jika arah kiblat belum dihitung, tidak perlu menghitung rotasi
  if (AppState.qiblaDirection === null) return;

  // Update badge menjadi aktif karena data tersedia
  updateSensorBadge("GPS Aktif", BADGE_STATUS.ACTIVE);

  // Hitung rotasi panah berdasarkan heading dan arah kiblat
  const rotation = calculateArrowRotation(
    AppState.qiblaDirection,
    data.heading,
  );

  // Perbarui posisi panah kompas
  updateCompassArrow(rotation);

  // Hitung selisih sudut terkecil antara heading dan arah kiblat,
  // lalu tentukan apakah sudah berada dalam toleransi
  const angleDifference = getAngleDifference(
    data.heading,
    AppState.qiblaDirection,
  );
  const isAligned = angleDifference <= QIBLA_TOLERANCE;

  // Perbarui indikator status kesejajaran kiblat
  updateQiblaStatus(isAligned);
}

/**
 * Menghentikan kompas yang sedang berjalan dan mereset state terkait
 */
function cleanupCompass() {
  stopCompass();
  AppState.isCompassActive = false;
  AppState.currentHeading = null;
}

/**
 * Menginisialisasi sensor kompas setelah lokasi didapatkan
 *
 * Alur:
 * 1. Minta izin sensor (diperlukan untuk Safari iOS)
 * 2. Hentikan kompas yang mungkin sedang berjalan
 * 3. Mulai kompas dengan callback handler
 *
 * @throws {Error} Jika izin ditolak atau kompas tidak bisa dimulai
 */
async function initializeCompass() {
  try {
    // Langkah 1: Minta izin sensor
    // Safari iOS memerlukan ini, Android langsung return true
    const permissionGranted = await requestCompassPermission();

    if (!permissionGranted) {
      updateSensorBadge("Sensor Ditolak", BADGE_STATUS.ERROR);
      console.warn("⚠️ Izin sensor kompas ditolak");
      return;
    }

    AppState.compassPermissionGranted = true;

    // Langkah 2: Hentikan kompas sebelumnya (mencegah duplikasi listener)
    cleanupCompass();

    // Langkah 3: Mulai kompas dengan handler
    startCompass(handleCompassData);
    AppState.isCompassActive = true;

    // Update badge menunggu data pertama
    updateSensorBadge("Menunggu Kompas...", BADGE_STATUS.CALIBRATING);
  } catch (error) {
    console.error("❌ Gagal menginisialisasi kompas:", error);
    updateSensorBadge("Kompas Error", BADGE_STATUS.ERROR);
  }
}

/**
 * Memproses permintaan pencarian kiblat
 * Alur utama aplikasi:
 *
 * Klik Tombol
 *    │
 *    ▼
 * Validasi Dukungan Browser
 *    │
 *    ▼
 * Cek Izin Lokasi
 *    │
 *    ▼
 * Loading State
 *    │
 *    ▼
 * GPS → Dapatkan Latitude & Longitude
 *    │
 *    ▼
 * Hitung Arah Kiblat
 *    │
 *    ▼
 * Update UI (Koordinat + Derajat)
 *    │
 *    ▼
 * Request Izin Kompas
 *    │
 *    ▼
 * Start Kompas (Heading Realtime)
 *    │
 *    ▼
 * Hitung Rotasi & Putar Panah
 */
async function handleFindQibla() {
  // Cegah double-click
  if (AppState.isProcessing) return;

  AppState.isProcessing = true;
  setButtonDisabled(true);

  try {
    // ========== LANGKAH 1: Validasi Dukungan Geolocation ==========
    if (!isGeolocationSupported()) {
      setErrorState("Browser tidak mendukung GPS");
      return;
    }

    // ========== LANGKAH 2: Cek Izin Lokasi ==========
    const permissionStatus = await checkLocationPermission();

    if (permissionStatus === "denied") {
      setErrorState(
        "Izin lokasi telah diblokir. Periksa pengaturan browser Anda.",
      );
      return;
    }

    // ========== LANGKAH 3: Loading State ==========
    setLoadingState();

    // Hentikan kompas yang mungkin berjalan dari sesi sebelumnya
    cleanupCompass();
    AppState.qiblaDirection = null;
    updateCompassArrow(0);

    // ========== LANGKAH 4: Ambil GPS ==========
    const position = await getUserPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    const { latitude, longitude } = position;

    // ========== LANGKAH 5: Hitung Arah Kiblat ==========
    const qiblaDirection = calculateQiblaDirection(latitude, longitude);
    AppState.qiblaDirection = qiblaDirection;

    // ========== LANGKAH 6: Update UI ==========
    setSuccessState(latitude, longitude, qiblaDirection);

    // Log untuk debugging
    console.log("📍 Lokasi:", { latitude, longitude });
    console.log("🕋 Arah Kiblat:", formatBearing(qiblaDirection));

    // ========== LANGKAH 7 & 8: Inisialisasi Kompas ==========
    await initializeCompass();

    // ========== LANGKAH 9: Panah akan diupdate otomatis oleh handleCompassData ==========
    // Callback startCompass akan memanggil handleCompassData
    // yang menghitung rotasi dan memanggil updateCompassArrow
  } catch (error) {
    // ========== ERROR HANDLING ==========
    console.error("❌ Gagal:", error);

    // Mapping error type ke pesan yang user-friendly
    const errorMessages = {
      [GeolocationErrorType.PERMISSION_DENIED]: "Izin lokasi ditolak",
      [GeolocationErrorType.POSITION_UNAVAILABLE]: "Lokasi tidak tersedia",
      [GeolocationErrorType.TIMEOUT]: "Waktu permintaan habis. Coba lagi.",
      [GeolocationErrorType.UNSUPPORTED]: "Browser tidak mendukung GPS",
      [GeolocationErrorType.INVALID_DATA]: "Data lokasi tidak valid",
      [GeolocationErrorType.UNKNOWN]: "Gagal mendapatkan lokasi",
    };

    const errorMessage =
      errorMessages[error.type] || error.message || "Gagal mendapatkan lokasi";
    setErrorState(errorMessage);

    // Bersihkan state
    AppState.qiblaDirection = null;
    cleanupCompass();
  } finally {
    // ========== SELALU KEMBALIKAN TOMBOL ==========
    AppState.isProcessing = false;
    setButtonDisabled(false);
  }
}

/**
 * Mengaktifkan atau menonaktifkan tombol
 * Mencegah interaksi ganda saat proses berlangsung
 *
 * @param {boolean} disabled - true untuk menonaktifkan
 */
function setButtonDisabled(disabled) {
  if (!DOM.allowLocationBtn) return;

  DOM.allowLocationBtn.disabled = disabled;
  DOM.allowLocationBtn.style.opacity = disabled ? "0.7" : "1";
  DOM.allowLocationBtn.style.cursor = disabled ? "not-allowed" : "pointer";
}

// ==================== INITIALIZATION ====================

/**
 * Inisialisasi aplikasi saat halaman dimuat
 *
 * Tugas:
 * - Setup event listener tombol
 * - Cek status izin awal
 * - Tampilkan UI awal yang sesuai
 * - Daftarkan cleanup handler
 */
async function initializeApp() {
  // Validasi: pastikan tombol utama tersedia
  if (!DOM.allowLocationBtn) {
    console.error("❌ Elemen #allowLocationBtn tidak ditemukan di DOM");
    return;
  }

  // ========== Event Listener: Klik Tombol ==========
  DOM.allowLocationBtn.addEventListener("click", handleFindQibla);

  // ========== Event Listener: Cleanup saat halaman ditutup ==========
  // Memastikan event listener kompas dibersihkan
  window.addEventListener("beforeunload", () => {
    cleanupCompass();
  });

  // ========== Event Listener: Visibility Change ==========
  // Hentikan kompas saat tab tidak aktif (hemat baterai)
  // Lanjutkan saat tab aktif kembali jika kompas sedang berjalan
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Tab tidak terlihat, hentikan kompas
      if (AppState.isCompassActive) {
        cleanupCompass();
        AppState._wasActiveBeforeHidden = true;
      }
    } else {
      // Tab terlihat kembali, lanjutkan kompas jika diperlukan
      if (AppState._wasActiveBeforeHidden && AppState.qiblaDirection !== null) {
        initializeCompass();
        AppState._wasActiveBeforeHidden = false;
      }
    }
  });

  // ========== Set UI Awal ==========
  resetUI();

  // ========== Cek Status Awal ==========
  await checkInitialStatus();

  console.log("🕌 Kiblat Finder siap digunakan");
}

/**
 * Mengecek status awal browser dan izin
 * Memberikan feedback yang sesuai kepada pengguna
 */
async function checkInitialStatus() {
  // Cek dukungan geolocation
  if (!isGeolocationSupported()) {
    setErrorState("Browser tidak mendukung GPS");
    setButtonDisabled(true);
    return;
  }

  // Cek status izin lokasi
  const locationPermission = await checkLocationPermission();

  switch (locationPermission) {
    case "granted":
      updateLocationPlaceholder(
        "Izin lokasi sudah diberikan. Klik tombol untuk mulai.",
        LOCATION_STATUS.SUCCESS,
      );
      updateSensorBadge("Siap", BADGE_STATUS.READY);
      break;

    case "denied":
      updateLocationPlaceholder(
        "Izin lokasi diblokir. Periksa pengaturan browser.",
        LOCATION_STATUS.ERROR,
      );
      updateSensorBadge("Diblokir", BADGE_STATUS.ERROR);
      break;

    case "prompt":
      updateLocationPlaceholder(
        "Klik tombol untuk mengizinkan akses lokasi",
        LOCATION_STATUS.LOADING,
      );
      updateSensorBadge("Siap", BADGE_STATUS.READY);
      break;

    default:
      // Permissions API tidak didukung
      updateLocationPlaceholder(
        "Klik tombol untuk memulai",
        LOCATION_STATUS.LOADING,
      );
      updateSensorBadge("Siap", BADGE_STATUS.READY);
      break;
  }
}

// ==================== START APLIKASI ====================

// Jalankan setelah DOM siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOM sudah siap (kemungkinan script dimuat dengan defer/async)
  initializeApp();
}

// ==================== EXPORTS ====================

// Ekspor fungsi utama untuk keperluan testing atau penggunaan eksternal
export {
  handleFindQibla,
  resetUI,
  cleanupCompass,
  updateCompassArrow,
  calculateArrowRotation,
  getAngleDifference,
  updateQiblaStatus,
};
