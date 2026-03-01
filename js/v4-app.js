// ─── OPENDISTRICTS V4 — v4-app.js (THIN ORCHESTRATOR) ────────────────────────
// This file owns:
//   • AppState (single source of truth)
//   • Controlled state mutators
//   • emit() event bus (cross-controller communication)
//   • loadDistrict() — coordinates all controllers
//   • boot() — initialization sequence
//
// This file does NOT contain any:
//   • DOM rendering logic (see controllers/)
//   • Animation logic (see map-controller.js)
//   • Direct Leaflet API calls (see map-controller.js)
//   • Direct DataService data fetches other than in loadDistrict / onLiveUpdate
// ─────────────────────────────────────────────────────────────────────────────

import { DataService } from "./services/data-service.js";
import * as TimelineCtrl from "./controllers/timeline-controller.js";
import * as MapCtrl from "./controllers/map-controller.js";
import * as AICtrl from "./controllers/ai-controller.js";
import * as TimeCtrl from "./controllers/time-controller.js";
import * as HierarchyCtrl from "./controllers/hierarchy-controller.js";
import { formatCardTime } from "./services/time-processor.js";

// ═══════════════════════════════════════════════════════════════════
// 1. APP STATE — single source of truth
// ═══════════════════════════════════════════════════════════════════

const AppState = {
    locale: "en",
    translations: {},
    mode: "district",
    connectionStatus: "live",       // "live" | "reconnecting" | "offline"
    isHistorical: false,
    currentStateId: "OD",
    currentDistrictId: "khordha",
    currentDistrict: null,
    events: [],
    timeBuckets: [],
    focusedEventId: null,
    manuallyCollapsed: false,
    autoHideTimer: null,
    isPanning: false,
    isAutoPlaying: false,
    autoPlayTimer: null,
    autoPlayBucketIndex: 0,
    consecutiveSlowFrames: 0,
    envOverlaysEnabled: true,
};

// ═══════════════════════════════════════════════════════════════════
// 2. EVENT BUS — zero-config, synchronous
// ═══════════════════════════════════════════════════════════════════

const _listeners = {};
function emit(event, payload) {
    (_listeners[event] ?? []).forEach(fn => fn(payload));
}
function on(event, fn) {
    (_listeners[event] = _listeners[event] ?? []).push(fn);
}

// ── Cross-controller wiring ───────────────────────────────────────
function _wireEvents() {
    // Map region click → focus event
    on("map:regionClick", ({ eventId }) => setFocusedEvent(eventId));

    // Timeline card tap → focus event
    on("timeline:cardTap", ({ eventId }) => setFocusedEvent(eventId));

    // Hierarchy: district selected → reload
    on("hierarchy:districtSelected", ({ districtId, stateId }) => {
        AICtrl.close();
        loadDistrict(districtId, stateId);
    });

    // Time scrub → check historical boundary
    on("time:historicalChanged", ({ isHistorical }) => setHistoricalMode(isHistorical));

    // Time bucket step during autoplay → update map snapshot
    on("time:bucketStep", ({ bucketIndex }) => {
        MapCtrl.applyHistoricalSnapshot(bucketIndex, AppState.timeBuckets, AppState.events);
    });

    // Perf degradation → disable env overlays
    on("perf:envDisabled", () => {
        AppState.envOverlaysEnabled = false;
        MapCtrl.syncModeClass(AppState.mode, AppState.isHistorical, AppState.connectionStatus, false);
    });

    // Timeline collapse: update AppState + allow map to re-show
    on("timeline:collapseChanged", ({ collapsed }) => {
        AppState.manuallyCollapsed = collapsed;
    });
}

// ═══════════════════════════════════════════════════════════════════
// 3. CONTROLLED STATE MUTATORS
// ═══════════════════════════════════════════════════════════════════

function setFocusedEvent(eventId) {
    if (AppState.focusedEventId === eventId) return;
    AppState.focusedEventId = eventId;
    TimelineCtrl.renderFocusState(eventId);
    MapCtrl.syncFocus(eventId, AppState.events);
}

function setMode(newMode) {
    if (AppState.mode === newMode) return;
    AppState.mode = newMode;
    _renderModeToggle();
    MapCtrl.syncModeClass(newMode, AppState.isHistorical, AppState.connectionStatus, AppState.envOverlaysEnabled);
    MapCtrl.runArbitration();
}

function setHistoricalMode(isHistorical) {
    if (AppState.isHistorical === isHistorical) return;
    AppState.isHistorical = isHistorical;

    if (isHistorical) {
        DataService.unsubscribeLiveUpdates(AppState.currentDistrictId);
    } else {
        DataService.subscribeLiveUpdates(AppState.currentDistrictId, _onLiveUpdate);
    }

    _renderSyncDot();
    TimeCtrl.renderBadge(isHistorical);
    MapCtrl.syncModeClass(AppState.mode, isHistorical, AppState.connectionStatus, AppState.envOverlaysEnabled);
    MapCtrl.runArbitration();
}

// ═══════════════════════════════════════════════════════════════════
// 4. DISTRICT LOAD — coordinates all controllers
// ═══════════════════════════════════════════════════════════════════

let _unsubscribeLive;

async function loadDistrict(districtId, stateId) {
    if (_unsubscribeLive) _unsubscribeLive();
    DataService.unsubscribeLiveUpdates(AppState.currentDistrictId);
    TimeCtrl.stopAutoPlay();

    AppState.currentDistrictId = districtId;
    AppState.currentStateId = stateId ?? AppState.currentStateId;
    AppState.focusedEventId = null;
    AppState.isHistorical = false;
    AppState.connectionStatus = "live"; // Phase 2 fix: always "live" in mock

    const district = await DataService.getDistrictById(districtId);

    const [events, timeBuckets, translation, geoData] = await Promise.all([
        DataService.getEventsForDistrict(districtId),
        DataService.getTimeSeries(districtId),
        DataService.getTranslation(AppState.locale),
        DataService.getGeoJSON(district.geoJsonUrl),
    ]);

    AppState.currentDistrict = district;
    AppState.events = events;
    AppState.timeBuckets = timeBuckets;
    AppState.translations = translation.strings;

    // Update all controllers
    _renderTopBarDistrict(district);
    TimelineCtrl.renderPanelHeader(district.name);
    TimelineCtrl.setGeoData(geoData);
    TimelineCtrl.renderTimeline(events);
    TimeCtrl.renderTimeAxis(timeBuckets);
    TimeCtrl.renderBadge(false);
    _renderSyncDot();
    AICtrl.reset();
    MapCtrl.syncModeClass(AppState.mode, false, "live", AppState.envOverlaysEnabled);

    // Load geo (async — non-blocking to timeline)
    await MapCtrl.loadDistrictGeo(district, events);

    // Subscribe to mock live updates
    _unsubscribeLive = DataService.subscribeLiveUpdates(districtId, _onLiveUpdate);
    MapCtrl.runArbitration();
}

// ═══════════════════════════════════════════════════════════════════
// 5. LIVE UPDATE HANDLER
// ═══════════════════════════════════════════════════════════════════

function _onLiveUpdate({ type, event }) {
    if (type === "event.new") {
        AppState.events.push(event);
        AppState.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (type === "event.updated") {
        const idx = AppState.events.findIndex(e => e.id === event.id);
        if (idx !== -1) AppState.events[idx] = event;
    } else if (type === "event.expired") {
        AppState.events = AppState.events.filter(e => e.id !== event.id);
        if (AppState.focusedEventId === event.id) setFocusedEvent(null);
    }
    TimelineCtrl.renderTimeline(AppState.events);
    if (AppState.focusedEventId) TimelineCtrl.renderFocusState(AppState.focusedEventId);
    MapCtrl.runArbitration();
}

// ═══════════════════════════════════════════════════════════════════
// 6. TOP BAR RENDERS
// ═══════════════════════════════════════════════════════════════════

function _renderTopBarDistrict(district) {
    const name = document.getElementById("tb-district-name");
    if (name) name.textContent = district.name;
}

async function _renderLanguageSelector() {
    const locales = await DataService.getAvailableLocales();
    const container = document.getElementById("tb-lang");
    if (!container) return;
    container.innerHTML = "";
    locales.slice(0, 3).forEach(locale => {
        const btn = document.createElement("button");
        btn.className = "lang-pill" + (locale === AppState.locale ? " active" : "");
        btn.textContent = locale.toUpperCase();
        btn.setAttribute("aria-pressed", locale === AppState.locale);
        btn.addEventListener("click", () => _switchLocale(locale));
        container.appendChild(btn);
    });
}

function _renderModeToggle() {
    document.getElementById("mode-district")?.classList.toggle("active", AppState.mode === "district");
    document.getElementById("mode-live")?.classList.toggle("active", AppState.mode === "live");
}

function _renderSyncDot() {
    const dot = document.getElementById("sync-dot");
    const label = document.getElementById("sync-label");
    if (!dot || !label) return;
    dot.classList.toggle("historical", AppState.isHistorical);
    label.classList.toggle("historical", AppState.isHistorical);
    label.textContent = AppState.isHistorical ? "HISTORICAL" : "LIVE";
}

async function _switchLocale(locale) {
    AppState.locale = locale;
    const translation = await DataService.getTranslation(locale);
    AppState.translations = translation.strings;
    _renderLanguageSelector();
    TimelineCtrl.renderTimeline(AppState.events);
    TimelineCtrl.renderFocusState(AppState.focusedEventId);
}

// ═══════════════════════════════════════════════════════════════════
// 7. BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════════════

async function boot() {
    // Create inject context for controllers
    const ctx = { state: AppState, ds: DataService, emit };

    // Init all controllers (no feature additions during split — pure extraction)
    MapCtrl.init(ctx);
    TimelineCtrl.init(ctx);
    AICtrl.init(ctx);
    TimeCtrl.init(ctx);
    HierarchyCtrl.init(ctx);

    // Wire cross-controller event routing
    _wireEvents();

    // Mode toggle buttons
    document.getElementById("mode-district")?.addEventListener("click", () => setMode("district"));
    document.getElementById("mode-live")?.addEventListener("click", () => setMode("live"));

    // Load initial district
    await TimelineCtrl.prefetchRegions("khordha");
    await loadDistrict("khordha", "OD");

    await _renderLanguageSelector();

    console.log("[V4] Boot complete. Controllers: timeline, map, ai, time, hierarchy.");
}

boot();
