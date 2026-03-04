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

// ── Local storage key for saved district selection ─────────────────────────────
const STORAGE_KEY = "opendistricts_savedDistrict";

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
    districtScopeLocked: true, // Default to limiting events to district boundary
    timelineRange: null,  // { from: ISO string, to: ISO string } or null for live mode
};

// ═══════════════════════════════════════════════════════════════════
// 1.5 TRANSLATION HELPER — get strings in current locale
// ═══════════════════════════════════════════════════════════════════

/**
 * Get a translated string by key, with optional variable substitution.
 * If translation not available, returns the key itself.
 * Usage: t('ui.weeklyEvents') or t('ui.alertCount', { count: 5 })
 */
export function t(key, vars = {}) {
    let str = AppState.translations[key] ?? key;
    
    // Variable substitution: {name} → value
    Object.entries(vars).forEach(([varName, value]) => {
        str = str.replace(`{${varName}}`, value);
    });
    
    return str;
}

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
    // Top bar: unlock district scope toggle
    const scopeToggle = document.getElementById("unlock-district-scope");
    if (scopeToggle) {
        scopeToggle.addEventListener("change", (e) => {
            AppState.districtScopeLocked = !e.target.checked;
            // Reload the district to rebuild events and timeline with new scope
            loadDistrict(AppState.currentDistrictId, AppState.currentStateId);
        });
    }

    // Map region click → focus event
    on("map:regionClick", ({ eventId }) => setFocusedEvent(eventId));

    // Timeline card tap → focus event
    on("timeline:cardTap", ({ eventId }) => setFocusedEvent(eventId));

    // Hierarchy: district selected → reload + SAVE to localStorage (Option C)
    on("hierarchy:districtSelected", ({ districtId, stateId }) => {
        AICtrl.close();
        loadDistrict(districtId, stateId);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ districtId, stateId }));
            console.log(`[V4] Saved district to localStorage: ${districtId} (${stateId})`);
        } catch (e) {
            console.warn("[V4] Could not write to localStorage.", e);
        }
    });

    // Pause heavy background ops while hierarchy selector is full screen
    on("hierarchy:opened", () => {
        AppState.wasAutoPlaying = AppState.isAutoPlaying;
        TimeCtrl.stopAutoPlay();
        if (!AppState.isHistorical) {
            DataService.unsubscribeLiveUpdates(AppState.currentDistrictId);
        }
    });

    on("hierarchy:closed", () => {
        if (AppState.wasAutoPlaying) TimeCtrl.resumeAutoPlay();
        if (!AppState.isHistorical) {
            DataService.subscribeLiveUpdates(AppState.currentDistrictId, _onLiveUpdate);
        }
    });

    // Time scrub → check historical boundary
    on("time:historicalChanged", ({ isHistorical }) => setHistoricalMode(isHistorical));

    // Time scrub → update map snapshot and timeline
    on("time:scrub", ({ frac }) => {
        if (!AppState.timeBuckets || AppState.timeBuckets.length === 0) return;

        // Reset to full live mode if scrubbing all the way to the end
        if (frac > 0.99) {
            AppState.timelineRange = null; // Return to live mode
            MapCtrl.clearHistoricalSnapshot(AppState.events);
            TimelineCtrl.clearHistoricalSnapshot();
            _syncHierarchyWithTimeline(); // Refresh hierarchy counts
            _renderSyncDot(); // Reset top bar to LIVE
            return;
        }

        let bucketIndex = Math.floor(frac * AppState.timeBuckets.length);
        if (bucketIndex >= AppState.timeBuckets.length) bucketIndex = AppState.timeBuckets.length - 1;

        const bucket = AppState.timeBuckets[bucketIndex];
        
        // Update AppState with the selected time range
        AppState.timelineRange = {
            from: bucket.startTs || bucket.endTs,
            to: bucket.endTs
        };
        
        const d = new Date(bucket.startTs);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dateStr = `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
        let labelText = `<span style="font-weight:600">${dateStr}</span>`;

        if (bucket.resolution === "hour" || bucket.resolution === "half-hour") {
            const hh = String(d.getUTCHours()).padStart(2, "0");
            const mm = String(d.getUTCMinutes()).padStart(2, "0");
            labelText += ` <span style="opacity:0.7">· ${hh}:${mm}</span>`;
        }

        _renderSyncDot(labelText);
        MapCtrl.applyHistoricalSnapshot(bucketIndex, AppState.timeBuckets, AppState.events);
        TimelineCtrl.applyHistoricalSnapshot(bucketIndex, AppState.timeBuckets, AppState.events);
        _syncHierarchyWithTimeline(); // Refresh hierarchy counts for scrub position
    });

    // Time bucket step during autoplay → update map snapshot + timeline
    on("time:bucketStep", ({ bucketIndex }) => {
        const bucket = AppState.timeBuckets[bucketIndex];
        
        // Update AppState with the current bucket range
        AppState.timelineRange = {
            from: bucket.startTs || bucket.endTs,
            to: bucket.endTs
        };

        const d = new Date(bucket.startTs);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dateStr = `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
        let labelText = `<span style="font-weight:600">${dateStr}</span>`;

        if (bucket.resolution === "hour" || bucket.resolution === "half-hour") {
            const hh = String(d.getUTCHours()).padStart(2, "0");
            const mm = String(d.getUTCMinutes()).padStart(2, "0");
            labelText += ` <span style="opacity:0.7">· ${hh}:${mm}</span>`;
        }

        _renderSyncDot(labelText);
        MapCtrl.applyHistoricalSnapshot(bucketIndex, AppState.timeBuckets, AppState.events);
        TimelineCtrl.applyHistoricalSnapshot(bucketIndex, AppState.timeBuckets, AppState.events);
        _syncHierarchyWithTimeline(); // Refresh hierarchy counts during autoplay
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
    document.body.classList.toggle("live-active", newMode === "live");
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
    // TimeCtrl.renderBadge is handled directly by the timeline playhead itself dynamically
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
    // Preserve isHistorical and timelineRange — district change should not reset temporal state
    AppState.connectionStatus = "live"; // Phase 2 fix: always "live" in mock

    const district = await DataService.getDistrictById(districtId, AppState.currentStateId);

    // Load geojson first to allow spatial filtering if needed
    const geoData = await DataService.getGeoJSON(district.geoJsonUrl);

    // Decide if we fetch events for the specific district or the whole state (unlocked scope)
    let rawEvents = [];
    if (AppState.districtScopeLocked) {
        rawEvents = await DataService.getEventsForDistrict(districtId, AppState.timelineRange);
    } else {
        // Fetch ALL events (or all state events) if unlocked
        // Also pass timelineRange to respect temporal filtering
        rawEvents = await DataService.getAllMockEvents(AppState.timelineRange);
    }

    // Filter spatially to be strictly accurate inside the district boundaries if Locked
    // AND if the event has coordinates.
    let events = rawEvents;
    if (AppState.districtScopeLocked && geoData && window.turf) {
        // Build an array of unified polygons for the district to test against
        // Just use the bounding box to do a cheaper clip filter.
        events = rawEvents.filter(e => {
            if (e.districtId === districtId && (!e.location || !e.location.lat)) return true; // keep non-spatial region events
            if (e.location && e.location.lat && e.location.lng) {
                const pt = [e.location.lng, e.location.lat];
                let isInside = false;
                for (const f of geoData.features) {
                    if (turf.booleanPointInPolygon(pt, f)) {
                        isInside = true; break;
                    }
                }
                return isInside;
            }
            return false;
        });
    }

    // After filtering, rebuild time buckets from the filtered list
    // (We also re-pass it to DataService calculation)
    const timeBuckets = await DataService.calculateTimeSeriesDirectly(events);
    const translation = await DataService.getTranslation(AppState.locale);

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
    _renderSyncDot();
    AICtrl.reset();
    // ── FIX-3: Reset env overlay throttle on district change (DEV-05) ─
    AppState.envOverlaysEnabled = true;
    AppState.consecutiveSlowFrames = 0;
    console.log('[APP] Env overlays reset for new district:', districtId);
    // ─────────────────────────────────────────────────────────────────

    MapCtrl.syncModeClass(AppState.mode, false, "live", AppState.envOverlaysEnabled);

    // Load geo (async — non-blocking to timeline)
    await MapCtrl.loadDistrictGeo(district, events);

    // ── Restore temporal snapshot if user had a time filter active ─────────────
    // After loading a new district we have fresh timeBuckets. If a timelineRange
    // was active before the load, find the closest matching bucket and re-apply
    // the snapshot so the map and timeline stay in sync with the scrubber.
    if (AppState.timelineRange) {
        const cutoffMs = new Date(AppState.timelineRange.to).getTime();
        let bucketIndex = 0;
        for (let i = timeBuckets.length - 1; i >= 0; i--) {
            if (new Date(timeBuckets[i].endTs).getTime() <= cutoffMs) {
                bucketIndex = i;
                break;
            }
        }

        const bucket = timeBuckets[bucketIndex];
        if (bucket) {
            const frac = (bucketIndex + 1) / timeBuckets.length;
            TimeCtrl.setScrubberFrac(frac);
            MapCtrl.applyHistoricalSnapshot(bucketIndex, timeBuckets, events);
            TimelineCtrl.applyHistoricalSnapshot(bucketIndex, timeBuckets, events);

            // Restore sync dot date label
            const d = new Date(bucket.startTs ?? bucket.endTs);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const dateStr = `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
            let labelText = `<span style="font-weight:600">${dateStr}</span>`;
            if (bucket.resolution === "hour" || bucket.resolution === "half-hour") {
                const hh = String(d.getUTCHours()).padStart(2, "0");
                const mm = String(d.getUTCMinutes()).padStart(2, "0");
                labelText += ` <span style="opacity:0.7">· ${hh}:${mm}</span>`;
            }
            AppState.isHistorical = true;
            _renderSyncDot(labelText);
        }
    } else {
        AppState.isHistorical = false;
        _renderSyncDot();
    }
    // ──────────────────────────────────────────────────────────────────────────

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

let _langSelectorInitialized = false;
let _pillExpanded = false;
let _pillPosition = 0;
let _pillTargetPosition = 0;
let _pillDragging = false;
let _pillHasDragged = false;
let _pillStartX = 0;
let _pillStartPos = 0;
let _pillLastX = 0;
let _pillLastTime = 0;
let _pillVelocity = 0;
let _langNodes = [];
let _activeLocales = [];

async function _renderLanguageSelector() {
    const locales = await DataService.getAvailableLocales();
    _activeLocales = locales;

    // Map locale IDs to native displays
    const NATIVE_LANG_NAMES = {
        'en': 'EN',
        'hi': 'हिन्दी',
        'gu': 'ગુજરાતી',
        'mr': 'मराठी',
        'or': 'ଓଡ଼ିଆ',
        'kn': 'ಕನ್ನಡ',
        'ta': 'தமிழ்',
        'bn': 'বাংলা',
        'pa': 'ਪੰਜਾਬੀ',
        'te': 'తెలుగు',
        'ur': 'اردو'
    };

    const container = document.getElementById("tb-lang");
    const track = document.getElementById("langTrack");
    if (!container || !track) return;

    // Find initial index
    let activeIdx = locales.indexOf(AppState.locale);
    if (activeIdx === -1) activeIdx = 0;

    if (!_langSelectorInitialized) {
        _langSelectorInitialized = true;

        const VISIBLE_NODES = 7;
        const ITEM_WIDTH = 32;

        _pillPosition = activeIdx;
        _pillTargetPosition = activeIdx;

        for (let i = 0; i < VISIBLE_NODES; i++) {
            const el = document.createElement('div');
            el.className = 'lang-item';
            track.appendChild(el);
            _langNodes.push(el);
        }

        function renderLoop() {
            if (!_pillDragging) {
                _pillPosition += (_pillTargetPosition - _pillPosition) * 0.15;
            }
            const centerIndexInteger = Math.round(_pillPosition);

            if (!_pillDragging) {
                _pillTargetPosition = centerIndexInteger;
            }

            const len = _activeLocales.length;
            if (len > 0) {
                for (let idx = 0; idx < VISIBLE_NODES; idx++) {
                    const itemVirtualIndex = centerIndexInteger - Math.floor(VISIBLE_NODES / 2) + idx;
                    const langIndex = ((itemVirtualIndex % len) + len) % len;

                    const el = _langNodes[idx];
                    const loc = _activeLocales[langIndex];
                    el.textContent = NATIVE_LANG_NAMES[loc] || loc.toUpperCase();

                    if (itemVirtualIndex === centerIndexInteger) {
                        el.classList.add('active');
                    } else {
                        el.classList.remove('active');
                    }

                    const xOffset = (itemVirtualIndex - _pillPosition) * ITEM_WIDTH;
                    el.style.transform = `translateX(${xOffset}px)`;
                }
            }
            requestAnimationFrame(renderLoop);
        }

        requestAnimationFrame(renderLoop);

        // Touch & Mouse Events for pill
        container.addEventListener('pointerdown', (e) => {
            if (!_pillExpanded) {
                _pillExpanded = true;
                container.classList.add('expanded');
                return;
            }

            _pillDragging = true;
            _pillHasDragged = false;
            _pillStartX = e.clientX;
            _pillStartPos = _pillPosition;
            _pillLastX = e.clientX;
            _pillLastTime = performance.now();
            container.setPointerCapture(e.pointerId);
        });

        container.addEventListener('pointermove', (e) => {
            if (!_pillDragging) return;
            const deltaX = e.clientX - _pillStartX;
            if (Math.abs(deltaX) > 5) _pillHasDragged = true;

            _pillPosition = _pillStartPos - (deltaX / ITEM_WIDTH);

            const now = performance.now();
            const dt = now - _pillLastTime;
            if (dt > 0) _pillVelocity = (e.clientX - _pillLastX) / dt;
            _pillLastX = e.clientX;
            _pillLastTime = now;
        });

        container.addEventListener('pointerup', (e) => {
            if (_pillDragging && !_pillHasDragged) {
                // Was just a tap while open
                _pillExpanded = false;
                container.classList.remove('expanded');
                _pillDragging = false;

                const selectedRaw = Math.round(_pillPosition);
                const len = _activeLocales.length;
                const finalIndex = ((selectedRaw % len) + len) % len;
                const newLocale = _activeLocales[finalIndex];

                if (newLocale && newLocale !== AppState.locale) {
                    _switchLocale(newLocale);
                }
                return;
            }

            if (_pillDragging) {
                _pillDragging = false;
                const throwDistance = _pillVelocity * 15;
                _pillTargetPosition = Math.round(_pillPosition - (throwDistance / ITEM_WIDTH));

                setTimeout(() => {
                    const selectedRaw = Math.round(_pillTargetPosition);
                    const len = _activeLocales.length;
                    const finalIndex = ((selectedRaw % len) + len) % len;
                    const newLocale = _activeLocales[finalIndex];
                    if (newLocale && newLocale !== AppState.locale) {
                        _switchLocale(newLocale);
                    }
                }, 300);
            }
        });

        // Click outside to collapse
        document.addEventListener('click', (e) => {
            if (_pillExpanded && !container.contains(e.target)) {
                _pillExpanded = false;
                container.classList.remove('expanded');

                const selectedRaw = Math.round(_pillTargetPosition);
                const len = _activeLocales.length;
                const finalIndex = ((selectedRaw % len) + len) % len;
                const newLocale = _activeLocales[finalIndex];
                if (newLocale && newLocale !== AppState.locale) {
                    _switchLocale(newLocale);
                }
            }
        });
    } else {
        // Find nearest integer that matches activeIdx
        if (!_pillDragging) {
            const len = _activeLocales.length;
            const currentMod = ((_pillTargetPosition % len) + len) % len;
            let offset = activeIdx - currentMod;
            if (offset > len / 2) offset -= len;
            else if (offset < -len / 2) offset += len;
            _pillTargetPosition += offset;
        }
    }
}

function _renderModeToggle() {
    document.getElementById("mode-district")?.classList.toggle("active", AppState.mode === "district");
    document.getElementById("mode-live")?.classList.toggle("active", AppState.mode === "live");
}

function _renderSyncDot(overrideText = null) {
    const dot = document.getElementById("sync-dot");
    const label = document.getElementById("sync-label");
    if (!dot || !label) return;
    dot.classList.toggle("historical", AppState.isHistorical);
    label.classList.toggle("historical", AppState.isHistorical);

    if (overrideText) {
        label.innerHTML = overrideText;
    } else {
        label.textContent = AppState.isHistorical ? "HISTORICAL" : "LIVE";
    }
}

/**
 * Synchronize hierarchy selector counts with current timeline range.
 * Called when user scrubs timeline to update data point counts in
 * state/district selectors based on filtered (visible) events only.
 * 
 * Side effects:
 * - Updates AppState.currentDistrict with fresh dataPoints
 * - Refreshes hierarchy selector display if it's open
 */
async function _syncHierarchyWithTimeline() {
    if (!AppState.currentDistrictId || !AppState.currentStateId) return;

    try {
        // Refetch current district with time-filtered counts
        const updated = await DataService.getDistrictById(
            AppState.currentDistrictId,
            AppState.currentStateId,
            AppState.timelineRange  // Pass current timeline range
        );

        if (updated) {
            AppState.currentDistrict = { ...AppState.currentDistrict, ...updated };
        }

        // Also refresh hierarchy display if it's open
        await HierarchyCtrl.syncWithTimeline(AppState.timelineRange);
    } catch (err) {
        console.warn("[V4] Failed to sync hierarchy with timeline:", err);
    }
}

function _updateTopBarLabels() {
    // Update district label in topbar
    const districtMeta = document.getElementById("tb-district-meta");
    if (districtMeta) {
        districtMeta.textContent = t('ui.currentDistrict');
    }
}

async function _switchLocale(locale) {
    AppState.locale = locale;
    const translation = await DataService.getTranslation(locale);
    AppState.translations = translation.strings;
    
    // Update all UI elements with new translations
    _renderLanguageSelector();
    _updateTopBarLabels();  // Update "WEEKLY EVENTS", etc.
    TimelineCtrl.renderTimeline(AppState.events);  // Re-render timeline with new category labels
    TimelineCtrl.renderFocusState(AppState.focusedEventId);
    AICtrl.updatePanelText();  // Update AI panel with translations
    HierarchyCtrl.updateLabels();  // Update hierarchy selector labels
}

// ═══════════════════════════════════════════════════════════════════
// 8. GEOLOCATION — detect user's state from browser GPS (Option B)
// ═══════════════════════════════════════════════════════════════════

/**
 * Given lat/lng, returns the stateId string by checking which state
 * polygon in the India GeoJSON contains the point.
 * Uses turf.booleanPointInPolygon for high accuracy boundary detection.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>}  stateId or null if outside all known polygons
 */
async function _detectStateFromCoords(lat, lng) {
    if (!window.turf) {
        console.warn("[V4/Geo] Turf.js not loaded. Cannot resolve coords to state.");
        return null;
    }

    try {
        // Load the HEAVY, accurate GeoJSON purely for backend math (keeps UI fast)
        const geoData = await DataService.getAccurateStatesGeoJSON();
        const pt = window.turf.point([lng, lat]);

        let matchedFeature = null;
        let altFeature = null;

        for (const feature of geoData.features) {
            // Check if feature is a valid polygon/multipolygon
            if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                if (window.turf.booleanPointInPolygon(pt, feature)) {
                    const geoName = feature.properties.name || feature.properties.NAME_1 || "";
                    if (geoName === "Haryana") {
                        matchedFeature = feature;
                        break;
                    } else if (geoName === "Delhi") {
                        altFeature = feature;
                    } else {
                        matchedFeature = feature;
                    }
                }
            }
        }

        const match = matchedFeature || altFeature;
        if (match) {
            const geoName = match.properties.name || match.properties.NAME_1 || "";
            const states = await DataService.getAllStates();
            const stateObj = states.find(s => s.name.toLowerCase() === geoName.toLowerCase());

            let resolvedId = stateObj ? stateObj.id : null;

            // Fallback map
            if (!resolvedId) {
                const idMap = { 'HARY': 'HR', 'MAHA': 'MH', 'DELH': 'DL', 'GUJA': 'GJ', 'UTTA': 'UP', 'KARN': 'KA', 'TAMI': 'TN', 'WEST': 'WB', 'PUNJ': 'PB', 'RAJA': 'RJ', 'MADH': 'MP', 'ORIS': 'OD' };
                resolvedId = match.properties.id ? (idMap[match.properties.id] || match.properties.id) : null;
            }

            console.log(`[V4] Geolocation matched state: ${geoName} -> ID: ${resolvedId}`);
            return resolvedId;
        }

        return null;
    } catch (e) {
        console.warn("[V4] State detection from coords failed.", e);
        return null;
    }
}

/**
 * Run geolocation detection and open the hierarchy at the right level.
 * - Approved → open the user's state district map (Tier 2)
 * - Denied / failed → open the full India state selector (Tier 1)
 */
function _runFirstTimeLocationFlow() {
    if (!navigator.geolocation) {
        console.log("[V4] Geolocation not supported. Defaulting to India map.");
        HierarchyCtrl.open();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        // ── SUCCESS (user approved) ──────────────────────────────────
        async (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`[V4] Geolocation granted: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            const stateId = await _detectStateFromCoords(latitude, longitude);
            if (stateId) {
                HierarchyCtrl.openState(stateId);
            } else {
                // User is outside India or point didn't match — fallback to India map
                console.log("[V4] Could not match location to a state. Showing India map.");
                HierarchyCtrl.open();
            }
        },
        // ── ERROR (user denied or timeout) ──────────────────────────
        (err) => {
            console.log(`[V4] Geolocation denied/failed (${err.code}). Showing India map.`);
            HierarchyCtrl.open();
        },
        { timeout: 8000, maximumAge: 60000 }
    );
}

// ═══════════════════════════════════════════════════════════════════
// 9. BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// 9. BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════════════

/**
 * Real application initialization.
 * Deferred until after the branding splash screen.
 */
async function startApp() {
    // Create inject context for controllers
    const ctx = { state: AppState, ds: DataService, emit };

    // Init all controllers
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

    // Check localStorage for a previously saved district
    let savedDistrict = null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) savedDistrict = JSON.parse(raw);
    } catch (e) {
        console.warn("[V4] Could not read localStorage.", e);
    }

    if (savedDistrict?.districtId && savedDistrict?.stateId) {
        // Returning user — restore their last district directly
        console.log(`[V4] Restoring saved district: ${savedDistrict.districtId} (${savedDistrict.stateId})`);
        await TimelineCtrl.prefetchRegions(savedDistrict.districtId);
        await loadDistrict(savedDistrict.districtId, savedDistrict.stateId);
    } else {
        // First-time visitor — load a default and then ask for location
        await TimelineCtrl.prefetchRegions("khordha");
        await loadDistrict("khordha", "OD");
        setTimeout(() => _runFirstTimeLocationFlow(), 600);
    }

    await _renderLanguageSelector();
    console.log("[V4] App Initialization Complete.");
}

/**
 * Splash Screen Orchestrator
 * Ensures branding is visible for 5s, then fades in 1s before starting app.
 */
async function boot() {
    console.log("[V4] Branding Splash Initiated (5s Pause + 1s Fade)");
    const splash = document.getElementById('splash-overlay');

    // 1. Branding Duration: 5 seconds
    setTimeout(() => {
        if (splash) {
            console.log("[V4] Splash Fading Out...");
            splash.classList.add('fade-out');
        }
    }, 5000);

    // 2. Total Delay before App Init: 6 seconds (5s branding + 1s fade)
    setTimeout(async () => {
        if (splash) splash.remove();
        console.log("[V4] Splash Removed. Starting App Initialization.");
        await startApp();
    }, 6000);
}

boot();
