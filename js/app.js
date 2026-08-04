// ============================================================
// APP.JS - Entry Point & Orchestrator
// ============================================================

import { normalizeAngle, lerpAngle, formatNumber, showToast, checkBrowserSupport } from './utils.js';
import { getCurrentPosition, startWatchingPosition, refreshLocation, getLastPosition } from './location.js';
import { startCompass, onHeadingUpdate, getCurrentHeading, isCompassActive, requestOrientationPermission, showCompassLoading, resetHeading } from './compass.js';
import { calculateQiblaData, formatQiblaDataForUI } from './qibla.js';

// ============================================================
// STATE MANAGEMENT
// ============================================================

const AppState = {
    // Data GPS
    userPosition: null,         // { latitude, longitude, accuracy, ... }
    gpsReady: false,

    // Data Kompas
    deviceHeading: null,        // 0-360 derajat
    compassReady: false,

    // Data Kiblat
    qiblaData: null,            // Hasil calculateQiblaData()

    // UI State
    isInitialized: false,
    animationFrameId: null,

    // Konfigurasi animasi
    currentCompassRotation: 0,  // Rotasi background kompas saat ini
    targetCompassRotation: 0,   // Target rotasi background kompas
    currentArrowRotation: 0,    // Rotasi panah saat ini
    targetArrowRotation: 0,     // Target rotasi panah
};

// ============================================================
// DOM ELEMENTS (Cache)
// ============================================================

const DOM = {
    compassContainer: null,
    compassBackground: null,
    qiblaArrow: null,
    qiblaIndicator: null,
    compassHeadingDisplay: null,
    compassLoading: null,
    btnCalibrate: null,
    btnRefreshLocation: null,
};

// ============================================================
// INISIALISASI UTAMA
// ============================================================

/**
 * Inisialisasi aplikasi
 */
async function initApp() {
    console.log('🚀 Qiblah Finder - Inisialisasi...');

    // 1. Cek dukungan browser
    const support = checkBrowserSupport();
    console.log('🔍 Browser Support:', support);

    if (!support.geolocation && !support.deviceOrientation) {
        showBrowserUnsupportedAlert(true);
        showToast('Browser tidak mendukung fitur yang diperlukan', 'danger', 8000);
        return;
    }

    // Update status browser di UI
    updateBrowserSupportUI(support);

    // 2. Cache DOM elements
    cacheDOMElements();

    // 3. Bangun kompas di DOM
    buildCompassDOM();

    // 4. Setup event listeners untuk tombol
    setupEventListeners();

    // 5. Mulai mendapatkan lokasi GPS
    console.log('📍 Memulai GPS...');
    try {
        const position = await getCurrentPosition();
        if (position) {
            AppState.userPosition = position;
            AppState.gpsReady = true;
            console.log('✅ GPS siap');
        }
    } catch (error) {
        console.warn('⚠️ GPS gagal, menunggu user action:', error.message);
        // GPS mungkin gagal, user bisa refresh nanti
    }

    // 6. Mulai sensor kompas
    console.log('🧭 Memulai sensor kompas...');
    try {
        const compassStarted = await startCompass();

        if (compassStarted) {
            AppState.compassReady = true;
            showCompassLoading(false);
            console.log('✅ Kompas siap');

            // Aktifkan tombol kalibrasi
            if (DOM.btnCalibrate) {
                DOM.btnCalibrate.disabled = false;
            }
        } else {
            // Mungkin iOS menunggu permission
            console.log('⏳ Kompas menunggu permission atau tidak tersedia');
        }
    } catch (error) {
        console.error('❌ Gagal memulai kompas:', error);
        showCompassLoading(false);
    }

    // 7. Register callback untuk update heading
    onHeadingUpdate(handleHeadingUpdate);

    // 8. Mulai animation loop
    startAnimationLoop();

    // 9. Update UI awal
    updateAllUI();

    AppState.isInitialized = true;
    console.log('✅ Qiblah Finder siap digunakan');
}

// ============================================================
// COMPASS DOM BUILDER
// ============================================================

/**
 * Membangun elemen kompas secara dinamis di dalam #compassContainer
 */
function buildCompassDOM() {
    const container = document.getElementById('compassContainer');

    if (!container) {
        console.error('❌ #compassContainer tidak ditemukan');
        return;
    }

    // Struktur kompas:
    // .compass-wrapper
    //   .compass-outer-ring
    //   .compass-inner-ring
    //   .compass-background (berputar)
    //     [degree marks & ticks]
    //   .qibla-arrow (panah statis menunjuk kiblat)
    //     .qibla-arrow-head
    //     .qibla-arrow-body
    //     .qibla-arrow-tail
    //   .qibla-indicator (indikator di tepi)
    //   .compass-center-pin
    //   .compass-heading-display

    const wrapper = document.createElement('div');
    wrapper.className = 'compass-wrapper';

    // Outer ring
    const outerRing = document.createElement('div');
    outerRing.className = 'compass-outer-ring';

    // Inner ring
    const innerRing = document.createElement('div');
    innerRing.className = 'compass-inner-ring';

    // Background (berputar)
    const background = document.createElement('div');
    background.className = 'compass-background';
    background.id = 'compassBackground';

    // Tambahkan degree marks & ticks ke background
    buildDegreeMarks(background);
    buildDirectionLabels(background);

    // Panah Kiblat
    const arrow = document.createElement('div');
    arrow.className = 'qibla-arrow';
    arrow.id = 'qiblaArrow';

    const arrowHead = document.createElement('div');
    arrowHead.className = 'qibla-arrow-head';

    const arrowBody = document.createElement('div');
    arrowBody.className = 'qibla-arrow-body';

    const arrowTail = document.createElement('div');
    arrowTail.className = 'qibla-arrow-tail';

    arrow.appendChild(arrowHead);
    arrow.appendChild(arrowBody);
    arrow.appendChild(arrowTail);

    // Indikator kiblat (di tepi)
    const indicator = document.createElement('div');
    indicator.className = 'qibla-indicator';
    indicator.id = 'qiblaIndicator';

    // Center pin
    const centerPin = document.createElement('div');
    centerPin.className = 'compass-center-pin';

    // Label "Kiblat"
    const label = document.createElement('div');
    label.className = 'qibla-label';
    label.textContent = '🕋';

    // Heading display
    const headingDisplay = document.createElement('div');
    headingDisplay.className = 'compass-heading-display';
    headingDisplay.id = 'compassHeadingDisplay';
    headingDisplay.textContent = '--°';

    // Assembly
    background.appendChild(indicator);
    wrapper.appendChild(outerRing);
    wrapper.appendChild(innerRing);
    wrapper.appendChild(background);
    wrapper.appendChild(arrow);
    wrapper.appendChild(centerPin);
    wrapper.appendChild(headingDisplay);

    container.appendChild(wrapper);

    // Cache DOM references
    DOM.compassContainer = container;
    DOM.compassBackground = background;
    DOM.qiblaArrow = arrow;
    DOM.qiblaIndicator = indicator;
    DOM.compassHeadingDisplay = headingDisplay;

    console.log('✅ Kompas DOM berhasil dibangun');
}

/**
 * Membuat tanda derajat pada background kompas
 */
function buildDegreeMarks(background) {
    const totalMarks = 72; // Setiap 5 derajat

    for (let i = 0; i < totalMarks; i++) {
        const degree = i * 5;
        const isMajor = degree % 15 === 0; // Setiap 15 derajat lebih tebal

        const mark = document.createElement('div');
        mark.className = isMajor
            ? 'compass-degree-mark compass-degree-mark--major'
            : 'compass-degree-mark';

        // Posisikan di tepi background
        // Sudut 0 di atas (Utara), bergerak searah jarum jam
        const angle = degree;
        const radius = 105; // px, jarak dari pusat

        // Transform: rotate dan translate
        mark.style.transform = `rotate(${angle}deg) translate(0, -${radius}px)`;
        mark.style.top = '50%';
        mark.style.left = '50%';

        background.appendChild(mark);
    }
}

/**
 * Membuat label arah mata angin (N, S, E, W dan turunannya)
 */
function buildDirectionLabels(background) {
    const directions = [
        { angle: 0, label: 'N', className: 'compass-tick--north' },
        { angle: 45, label: 'NE', className: '' },
        { angle: 90, label: 'E', className: '' },
        { angle: 135, label: 'SE', className: '' },
        { angle: 180, label: 'S', className: 'compass-tick--south' },
        { angle: 225, label: 'SW', className: '' },
        { angle: 270, label: 'W', className: '' },
        { angle: 315, label: 'NW', className: '' },
    ];

    const radius = 90; // px, sedikit lebih dalam dari degree marks

    directions.forEach(dir => {
        const tick = document.createElement('span');
        tick.className = `compass-tick ${dir.className}`;
        tick.textContent = dir.label;

        // Posisikan menggunakan transform
        tick.style.transform = `rotate(${dir.angle}deg) translate(0, -${radius}px)`;
        tick.style.top = '50%';
        tick.style.left = '50%';

        background.appendChild(tick);
    });
}

// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * Setup event listeners untuk tombol
 */
function setupEventListeners() {
    // Tombol Kalibrasi
    DOM.btnCalibrate = document.getElementById('btnCalibrate');
    if (DOM.btnCalibrate) {
        DOM.btnCalibrate.addEventListener('click', handleCalibrate);
    }

    // Tombol Refresh Lokasi
    DOM.btnRefreshLocation = document.getElementById('btnRefreshLocation');
    if (DOM.btnRefreshLocation) {
        DOM.btnRefreshLocation.addEventListener('click', handleRefreshLocation);
    }
}

/**
 * Handler untuk tombol kalibrasi
 * Di iOS: minta permission sensor
 * Di Android: reset heading
 */
async function handleCalibrate() {
    console.log('🔄 Tombol kalibrasi ditekan');

    // Cek apakah iOS butuh permission
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        const permissionGranted = await requestOrientationPermission();

        if (permissionGranted) {
            // Setelah permission granted, mulai kompas
            const compassStarted = await startCompass();
            if (compassStarted) {
                AppState.compassReady = true;
                showCompassLoading(false);
                if (DOM.btnCalibrate) {
                    DOM.btnCalibrate.textContent = '🔄 Kalibrasi';
                    DOM.btnCalibrate.classList.remove('btn-warning');
                    DOM.btnCalibrate.classList.add('btn-outline-primary');
                }
                updateAllUI();
            }
        }
    } else {
        // Android: reset heading dan tampilkan toast
        resetHeading();
        showToast('Kompas dikalibrasi. Gerakkan HP membentuk angka 8.', 'info', 4000);

        // Efek visual pada tombol
        if (DOM.btnCalibrate) {
            DOM.btnCalibrate.classList.add('active');
            setTimeout(() => {
                DOM.btnCalibrate.classList.remove('active');
            }, 300);
        }
    }
}

/**
 * Handler untuk tombol refresh lokasi
 */
async function handleRefreshLocation() {
    console.log('📍 Refresh lokasi...');

    if (DOM.btnRefreshLocation) {
        DOM.btnRefreshLocation.disabled = true;
        DOM.btnRefreshLocation.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Mencari...';
    }

    try {
        const position = await refreshLocation();
        if (position) {
            AppState.userPosition = position;
            AppState.gpsReady = true;
            updateAllUI();
        }
    } catch (error) {
        console.error('❌ Refresh lokasi gagal:', error);
    } finally {
        if (DOM.btnRefreshLocation) {
            DOM.btnRefreshLocation.disabled = false;
            DOM.btnRefreshLocation.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Refresh Lokasi';
        }
    }
}

/**
 * Handler untuk update heading dari sensor
 * Dipanggil setiap kali sensor kompas mengirim data baru
 */
function handleHeadingUpdate(heading) {
    if (heading === null || isNaN(heading)) return;

    AppState.deviceHeading = heading;
    AppState.compassReady = true;

    // Hitung target rotasi
    // Background berputar berlawanan dengan heading
    // Saat heading 0 (utara), background rotation 0
    // Saat heading 90 (timur), background rotation -90
    AppState.targetCompassRotation = -heading;

    // Hitung data kiblat jika GPS sudah siap
    if (AppState.gpsReady && AppState.userPosition) {
        const qiblaData = calculateQiblaData(
            AppState.userPosition.latitude,
            AppState.userPosition.longitude,
            heading
        );

        if (qiblaData && qiblaData.isValid) {
            AppState.qiblaData = qiblaData;

            // Target rotasi panah: panah selalu menunjuk bearing kiblat absolut
            AppState.targetArrowRotation = qiblaData.arrowRotation;

            // Update UI informasi kiblat setiap kali heading berubah
            updateQiblaInfoUI(qiblaData);
            updateQiblaIndicator(qiblaData);
        }
    }

    // Update tampilan heading
    updateHeadingDisplay(heading);
}

// ============================================================
// ANIMATION LOOP
// ============================================================

/**
 * Memulai animation loop menggunakan requestAnimationFrame
 * Untuk rotasi yang halus menggunakan interpolasi
 */
function startAnimationLoop() {
    function animate() {
        // Interpolasi rotasi background kompas
        if (AppState.currentCompassRotation !== AppState.targetCompassRotation) {
            AppState.currentCompassRotation = lerpAngle(
                AppState.currentCompassRotation,
                AppState.targetCompassRotation,
                0.15 // Faktor interpolasi (semakin kecil = semakin halus)
            );

            // Terapkan rotasi ke background
            if (DOM.compassBackground) {
                DOM.compassBackground.style.transform =
                    `rotate(${AppState.currentCompassRotation}deg)`;
            }
        }

        // Interpolasi rotasi panah kiblat
        if (AppState.currentArrowRotation !== AppState.targetArrowRotation) {
            AppState.currentArrowRotation = lerpAngle(
                AppState.currentArrowRotation,
                AppState.targetArrowRotation,
                0.12
            );

            // Terapkan rotasi ke panah
            if (DOM.qiblaArrow) {
                DOM.qiblaArrow.style.transform =
                    `rotate(${AppState.currentArrowRotation}deg)`;
            }
        }

        // Update posisi indikator kiblat di tepi kompas
        updateIndicatorPosition();

        AppState.animationFrameId = requestAnimationFrame(animate);
    }

    // Mulai loop
    AppState.animationFrameId = requestAnimationFrame(animate);
    console.log('🎬 Animation loop dimulai');
}

/**
 * Update posisi indikator kiblat di tepi kompas
 * Indikator selalu berada di arah bearing kiblat
 */
function updateIndicatorPosition() {
    if (!DOM.qiblaIndicator || !AppState.qiblaData) return;

    const qiblaBearing = AppState.qiblaData.qiblaBearing;
    if (qiblaBearing === null) return;

    // Indikator diposisikan di tepi background
    // Background berputar, jadi posisi indikator relatif terhadap background
    // Indikator harus selalu menunjukkan arah absolut kiblat
    // Karena background berputar sesuai heading, kita perlu menyesuaikan

    const heading = AppState.deviceHeading || 0;
    const indicatorAngle = qiblaBearing - heading;

    const radius = 105; // px, posisi di tepi

    DOM.qiblaIndicator.style.transform =
        `rotate(${indicatorAngle}deg) translate(0, -${radius}px)`;
    DOM.qiblaIndicator.style.top = '50%';
    DOM.qiblaIndicator.style.left = '50%';
}

// ============================================================
// UI UPDATE FUNCTIONS
// ============================================================
/**
 * 🆕 Update indikator panduan "Geser Sedikit Lagi"
 * @param {object} guidance - Object guidance dari qiblaData
 */
function updateGuidanceUI(guidance) {
    const guidanceBox = document.getElementById('guidanceBox');
    const guidanceIcon = document.getElementById('guidanceIcon');
    const guidanceText = document.getElementById('guidanceText');
    const guidanceDetail = document.getElementById('guidanceDetail');
    const guidanceProgressBar = document.getElementById('guidanceProgressBar');
    const guidanceArrow = document.getElementById('guidanceArrow');

    if (!guidanceBox || !guidance) return;

    // Hapus semua class severity
    guidanceBox.classList.remove('severity-success', 'severity-info', 'severity-warning', 'severity-secondary', 'severity-unknown');
    
    // Tambahkan class severity baru
    guidanceBox.classList.add(`severity-${guidance.severity}`);

    // Update icon
    if (guidanceIcon) {
        guidanceIcon.textContent = guidance.icon || '📡';
    }

    // Update teks utama
    if (guidanceText) {
        guidanceText.textContent = guidance.text || 'Menunggu Sensor...';
    }

    // Update progress bar
    if (guidanceProgressBar) {
        const percentage = guidance.percentage || 0;
        guidanceProgressBar.style.width = `${percentage}%`;
        guidanceProgressBar.setAttribute('aria-valuenow', percentage);

        // Warna progress bar sesuai severity
        guidanceProgressBar.classList.remove('bg-success', 'bg-info', 'bg-warning', 'bg-secondary');
        switch (guidance.severity) {
            case 'success':
                guidanceProgressBar.classList.add('bg-success');
                break;
            case 'info':
                guidanceProgressBar.classList.add('bg-info');
                break;
            case 'warning':
                guidanceProgressBar.classList.add('bg-warning');
                break;
            default:
                guidanceProgressBar.classList.add('bg-secondary');
                break;
        }
    }

    // Update detail
    if (guidanceDetail) {
        if (guidance.severity === 'success') {
            guidanceDetail.textContent = '✅ HP sudah menghadap ke arah Ka\'bah';
        } else if (guidance.absDifference !== undefined) {
            const directionText = guidance.direction === 'right' ? 'kanan' : 'kiri';
            guidanceDetail.textContent = `↗️ Putar HP ke ${directionText} sejauh ${guidance.absDifference}°`;
        } else {
            guidanceDetail.textContent = 'Nyalakan GPS dan sensor kompas';
        }
    }

    // Update panah arah
    if (guidanceArrow) {
        if (guidance.severity === 'success') {
            guidanceArrow.style.display = 'none';
        } else if (guidance.direction) {
            guidanceArrow.style.display = 'block';
            guidanceArrow.textContent = guidance.direction === 'right' ? '👉' : '👈';
            
            // Flip animasi jika ke kiri
            if (guidance.direction === 'left') {
                guidanceArrow.style.animation = 'bounceHorizontalReverse 1s infinite';
            } else {
                guidanceArrow.style.animation = 'bounceHorizontal 1s infinite';
            }
        } else {
            guidanceArrow.style.display = 'none';
        }
    }
}
/**
 * Update semua elemen UI
 */
function updateAllUI() {
    updateQiblaInfoUI(AppState.qiblaData);
    updateHeadingDisplay(AppState.deviceHeading);
    updateQiblaIndicator(AppState.qiblaData);
    updateSensorStatusUI();
}

/**
 * Update Card Informasi Kiblat
 */
function updateQiblaInfoUI(qiblaData) {
    if (!qiblaData || !qiblaData.isValid) {
        setElementText('infoQiblaBearing', '--°');
        setElementText('infoAngleDiff', '--°');
        setElementText('infoDistance', '-- km');
        updateQiblaStatusBadge(false);
        return;
    }

    const formatted = formatQiblaDataForUI(qiblaData);

    setElementText('infoQiblaBearing', formatted.qiblaBearing);
    setElementText('infoAngleDiff', formatted.angleDifference);
    setElementText('infoDistance', formatted.distance);
    updateQiblaStatusBadge(formatted.isFacingQibla);
}

/**
 * Update badge status menghadap kiblat
 */
function updateQiblaStatusBadge(isFacing) {
    const badgeContainer = document.getElementById('infoQiblaStatus');

    if (!badgeContainer) return;

    if (isFacing) {
        badgeContainer.innerHTML = '<span class="badge bg-success">Menghadap Kiblat 🎯</span>';
    } else {
        badgeContainer.innerHTML = '<span class="badge bg-secondary">Belum Menghadap Kiblat</span>';
    }
}

/**
 * Update tampilan heading di kompas dan card info
 */
function updateHeadingDisplay(heading) {
    // Display di kompas
    if (DOM.compassHeadingDisplay) {
        DOM.compassHeadingDisplay.textContent = heading !== null
            ? `${Math.round(heading)}°`
            : '--°';
    }

    // Display di card informasi kiblat
    setElementText('infoDeviceHeading', heading !== null ? `${heading.toFixed(1)}°` : '--°');
}

/**
 * Update indikator kiblat (warna hijau/abu-abu)
 */
function updateQiblaIndicator(qiblaData) {
    if (!DOM.qiblaIndicator) return;

    if (qiblaData && qiblaData.isFacingQibla) {
        DOM.qiblaIndicator.classList.add('qibla-indicator--active');
    } else {
        DOM.qiblaIndicator.classList.remove('qibla-indicator--active');
    }
}

/**
 * Update Card Status Sensor
 */
function updateSensorStatusUI() {
    // Status kompas
    const compassBadge = document.getElementById('infoCompassStatus');
    if (compassBadge) {
        if (AppState.compassReady) {
            compassBadge.innerHTML = '<span class="badge bg-success">Aktif</span>';
        } else if (isCompassActive()) {
            compassBadge.innerHTML = '<span class="badge bg-success">Aktif</span>';
        } else {
            compassBadge.innerHTML = '<span class="badge bg-secondary">Menunggu...</span>';
        }
    }

    // Status GPS
    const gpsBadge = document.getElementById('infoGPSSensorStatus');
    if (gpsBadge) {
        if (AppState.gpsReady) {
            gpsBadge.innerHTML = '<span class="badge bg-success">Aktif</span>';
        } else {
            gpsBadge.innerHTML = '<span class="badge bg-secondary">Menunggu...</span>';
        }
    }
}

/**
 * Update UI status dukungan browser
 */
function updateBrowserSupportUI(support) {
    const badge = document.getElementById('infoBrowserSupport');
    if (!badge) return;

    if (support.geolocation && support.deviceOrientation) {
        badge.innerHTML = '<span class="badge bg-success">Didukung Penuh</span>';
    } else if (support.geolocation || support.deviceOrientation) {
        badge.innerHTML = '<span class="badge bg-warning">Didukung Sebagian</span>';
    } else {
        badge.innerHTML = '<span class="badge bg-danger">Tidak Didukung</span>';
    }
}

/**
 * Tampilkan alert browser tidak didukung
 */
function showBrowserUnsupportedAlert(show) {
    const alert = document.getElementById('alertBrowserUnsupported');
    if (alert) {
        if (show) {
            alert.classList.remove('d-none');
        } else {
            alert.classList.add('d-none');
        }
    }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Set text content elemen by ID
 */
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
    }
}

/**
 * Cache semua referensi DOM yang sering digunakan
 */
function cacheDOMElements() {
    DOM.compassLoading = document.getElementById('compassLoading');
    DOM.btnCalibrate = document.getElementById('btnCalibrate');
    DOM.btnRefreshLocation = document.getElementById('btnRefreshLocation');
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Membersihkan resources saat halaman ditutup
 */
function cleanup() {
    if (AppState.animationFrameId) {
        cancelAnimationFrame(AppState.animationFrameId);
        AppState.animationFrameId = null;
    }

    console.log('🧹 Cleanup selesai');
}

// ============================================================
// START APP
// ============================================================

// Jalankan aplikasi saat DOM sudah siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM sudah siap
    initApp();
}

// Cleanup saat page unload
window.addEventListener('beforeunload', cleanup);
