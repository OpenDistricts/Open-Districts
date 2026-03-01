// ─── MAP CONTROLLER — v4-app.js extraction ────────────────────────────────────
// Owns: Leaflet init (ONCE), GeoJSON layer management, animation arbitration.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { loadDistrictGeo, syncFocus, syncModeClass, runArbitration }
// ─────────────────────────────────────────────────────────────────────────────

import {
    boundingBoxToLeaflet, categoryMarkerOptions, categoryPolygonStyle, districtBoundaryStyle, categoryTier
} from '../services/geo-service.js';
import { fuzzyMatch } from '../utils/string-matcher.js';

let _ctx;

// ── Leaflet handles (module-scoped, not on AppState) ──────────────
let _map;
let _boundaryLayer, _regionsLayer, _markersLayer, _maskLayer;
const _regionLayerMap = new Map(); // regionId → Leaflet layer

// ═══════════════════════════════════════════════════════════════════
// INIT — called ONCE at boot
// ═══════════════════════════════════════════════════════════════════

export function init(ctx) {
    _ctx = ctx;
    _initLeaflet();
}

function _initLeaflet() {
    _map = L.map("map", {
        zoomControl: false,
        doubleClickZoom: false,
        minZoom: 10,
        maxZoom: 19,
        scrollWheelZoom: true,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(_map);

    // Custom zoom buttons
    document.getElementById("zoom-in").addEventListener("click", () => _map.zoomIn());
    document.getElementById("zoom-out").addEventListener("click", () => _map.zoomOut());

    // Pan lifecycle → auto-hide timeline + arbitration suspension
    _map.on("movestart", () => {
        _ctx.state.isPanning = true;
        if (!_ctx.state.manuallyCollapsed) {
            document.getElementById("timeline-panel").classList.add("hidden");
        }
        _suspendAnimations();
        clearTimeout(_ctx.state.autoHideTimer);
    });

    _map.on("moveend", () => {
        clearTimeout(_ctx.state.autoHideTimer);
        _ctx.state.autoHideTimer = setTimeout(() => {
            if (!_ctx.state.manuallyCollapsed) {
                document.getElementById("timeline-panel").classList.remove("hidden");
            }
            _ctx.state.isPanning = false;
            runArbitration();
        }, _ctx.state.manuallyCollapsed ? 300 : 500);
    });
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC
// ═══════════════════════════════════════════════════════════════════

/** Load geography for a district. Clears previous layers. */
export async function loadDistrictGeo(district, events) {
    // Tear down previous layers
    if (_boundaryLayer) _map.removeLayer(_boundaryLayer);
    if (_regionsLayer) _map.removeLayer(_regionsLayer);
    if (_markersLayer) _map.removeLayer(_markersLayer);
    if (_maskLayer) _map.removeLayer(_maskLayer);
    _regionLayerMap.clear();

    // Fit to bounds and strictly cage the user
    // Convert array structure to L.LatLngBounds so we can pad it
    const bounds = L.latLngBounds(boundingBoxToLeaflet(district.boundingBox));
    _map.fitBounds(bounds, { padding: [20, 20] });

    // Prevent zooming out past the district or panning away to other states
    const padBounds = bounds.pad(0.05);
    _map.setMaxBounds(padBounds);

    // Set minZoom exactly to the level that fits the padded bounds 
    // without subtracting extra zoom levels to keep the map strictly caged.
    _map.setMinZoom(_map.getBoundsZoom(padBounds, false));

    // Try to load GeoJSON — falls back to mock grid in geo-service
    const geoData = await _ctx.ds.getGeoJSON(district.geoJsonUrl);

    const categoryMap = _buildCategoryByRegion(events);

    // ── DIAGNOSTIC: Expose regionId alignment (→ DEV-04 fix) ───────────
    console.log('[MAP DEBUG] Event regionIds:', events.map(e => e.regionId));
    console.log('[MAP DEBUG] GeoJSON feature IDs:', geoData.features.map(f =>
        f.properties?.id || f.properties?.NAME_2 || f.properties?.dtname || 'UNKNOWN'
    ));
    console.log('[MAP DEBUG] Category map keys:', Object.keys(categoryMap));

    // Fuzzy match alignment: bind 2011 Census GeoJSON features to actual event data slugs 
    // even if spellings or transliterations differ across datasets
    const knownEventRegions = Object.keys(categoryMap);
    geoData.features.forEach(feature => {
        let currId = feature.properties?.id ?? feature.id ?? "";
        // If exact match fails, attempt fuzzy matching the common name fields against events
        if (!categoryMap[currId]) {
            const rawNames = [feature.properties?.name, feature.properties?.NAME_3, feature.properties?.NAME_2].filter(Boolean);
            for (const n of rawNames) {
                const match = fuzzyMatch(n, knownEventRegions, 3);
                if (match) {
                    if (!feature.properties) feature.properties = {};
                    feature.properties.id = match;
                    feature.id = match;
                    console.log(`[MAP DEBUG] Fuzzy Matched geometry '${n}' to event region '${match}'`);
                    break;
                }
            }
        }
    });
    // ───────────────────────────────────────────────────────────────────────────

    // Create an inverted polygon to mask out everything outside the district
    const maskCoordinates = [
        [[90, -180], [90, 180], [-90, 180], [-90, -180]]
    ];

    L.geoJSON(geoData, {
        onEachFeature: (feature, layer) => {
            if (layer instanceof L.Polygon) {
                const latlngs = layer.getLatLngs();
                if (feature.geometry.type === "Polygon") {
                    maskCoordinates.push(latlngs[0]);
                } else if (feature.geometry.type === "MultiPolygon") {
                    latlngs.forEach(polygon => maskCoordinates.push(polygon[0]));
                }
            }
        }
    });

    _maskLayer = L.polygon(maskCoordinates, {
        fillColor: '#DDE1E7', // --map-base
        fillOpacity: 1.0,
        stroke: false,
        interactive: false
    }).addTo(_map);

    // District boundary ring
    _boundaryLayer = L.geoJSON(geoData, {
        style: districtBoundaryStyle(),
        interactive: false,
    }).addTo(_map);

    // Sub-district polygons
    _regionsLayer = L.geoJSON(geoData, {
        style: feature => {
            const regionId = feature.properties?.id ?? feature.id ?? "";
            const cat = categoryMap[regionId]?.category ?? "safety";
            return categoryPolygonStyle(cat, false);
        },
        onEachFeature: (feature, layer) => {
            const regionId = feature.properties?.id ?? feature.id ?? "";
            _regionLayerMap.set(regionId, layer);
            layer.on("click", () => {
                const ev = _topEventForRegion(regionId, events);
                _ctx.emit("map:regionClick", { eventId: ev?.id ?? null });
            });
        },
    }).addTo(_map);

    // Apply severity CSS classes after Leaflet adds SVG to DOM
    setTimeout(() => {
        _regionsLayer.eachLayer(layer => {
            const regionId = _idFromLayer(layer);
            if (!regionId || !layer._path) return;
            const cat = categoryMap[regionId]?.category ?? "safety";
            _applyCatClass(layer._path, cat);
        });
        runArbitration();
    }, 120);

    // Point markers
    const group = L.featureGroup();
    events.forEach(ev => {
        if (!ev.geoPoint) return;
        const opts = categoryMarkerOptions(ev.category);
        const marker = L.circleMarker([ev.geoPoint.lat, ev.geoPoint.lng], opts);
        marker.bindTooltip(ev.title, { sticky: true });
        marker.on("click", () => _ctx.emit("map:regionClick", { eventId: ev.id }));
        group.addLayer(marker);
    });
    _markersLayer = group.addTo(_map);
}

/** Highlight focused polygon, dim others, fly to bounds. */
export function syncFocus(focusedEventId, events) {
    const categoryMap = _buildCategoryByRegion(events);

    if (!focusedEventId) {
        _regionLayerMap.forEach((layer, regionId) => {
            const cat = categoryMap[regionId]?.category ?? "safety";
            layer.setStyle(categoryPolygonStyle(cat, false));
        });
        runArbitration();
        return;
    }

    const ev = events.find(e => e.id === focusedEventId);
    if (!ev) return;

    // Fly to event
    const targetLayer = ev.regionId ? _regionLayerMap.get(ev.regionId) : null;
    if (ev.geoPoint) {
        _map.flyTo([ev.geoPoint.lat, ev.geoPoint.lng], 14, { duration: 0.8 });
    } else if (targetLayer?.getBounds) {
        _map.fitBounds(targetLayer.getBounds(), { padding: [30, 30] });
    }

    // Style update
    _regionLayerMap.forEach((layer, regionId) => {
        const cat = categoryMap[regionId]?.category ?? "safety";
        const focused = ev.regionId && regionId === ev.regionId;
        layer.setStyle(categoryPolygonStyle(cat, focused));
    });

    runArbitration();
}

/** Apply district-view / live-mode class to #map + manage env overlays. */
export function syncModeClass(mode, isHistorical, connectionStatus, envEnabled) {
    const mapEl = document.getElementById("map");
    mapEl.classList.toggle("district-view", mode === "district");
    mapEl.classList.toggle("live-mode", mode === "live");

    const envActive = mode === "live" && !isHistorical && connectionStatus === "live" && envEnabled;
    mapEl.classList.toggle("env-active", envActive);
}

/** Update map layers to reflect a historical snapshot up to bucketIndex. */
export function applyHistoricalSnapshot(bucketIndex, timeBuckets, events) {
    if (!_regionsLayer) return;
    const cutoffTs = timeBuckets[bucketIndex]?.endTs;
    if (!cutoffTs) return;

    const cutoff = new Date(cutoffTs);
    const historicalEvts = events.filter(e => new Date(e.timestamp) <= cutoff);
    const categoryMap = _buildCategoryByRegion(historicalEvts);

    _regionLayerMap.forEach((layer, regionId) => {
        const cat = categoryMap[regionId]?.category ?? "safety";
        layer.setStyle(categoryPolygonStyle(cat, false));
        if (layer._path) _applyCatClass(layer._path, cat);
    });

    runArbitration();
}

/** Arbitration engine — governs all polygon animation play-state. */
export function runArbitration() {
    if (_ctx.state.isPanning || !_map.getBounds) return;

    const t0 = performance.now();
    const events = _ctx.state.events ?? [];
    const categoryMap = _buildCategoryByRegion(events);
    const isLive = _ctx.state.mode === "live" && !_ctx.state.isHistorical;
    const mapBounds = _map.getBounds();

    // Tier order: tier-1 (health/emergency) wins over tier-2, then tier-3.
    // Within same tier, most-recent timestamp breaks ties.
    const visible = [];
    _regionLayerMap.forEach((layer, regionId) => {
        const center = layer.getBounds?.().getCenter();
        if (!center || !mapBounds.contains(center)) return;
        const entry = categoryMap[regionId] ?? { category: "safety", timestamp: "0" };
        const tier = categoryTier(entry.category);
        visible.push({ regionId, layer, ...entry, tier });
    });

    // Sort: tier asc (tier-1 first), then timestamp desc
    visible.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const elapsed = performance.now() - t0;
    _updatePerfCounter(elapsed);
    const maxTier = _effectiveTierCeiling(elapsed);

    visible.forEach(({ layer, category, tier }, index) => {
        if (!layer._path) return;
        const path = layer._path;

        if (isLive) {
            // CSS drives animations via .cat-*-path classes.
            // JS only pauses paths beyond the tier cap.
            const isTier1Slot = tier === 1 && index === 0 && maxTier >= 1;
            const isTier2Slot = tier === 2 && index >= 1 && index <= 2 && maxTier >= 2;

            if (isTier1Slot || isTier2Slot) {
                path.style.animationPlayState = "running";
            } else {
                path.style.animationPlayState = "paused";
            }
        } else {
            // District View: only #1 tier-1 category animates
            const animate = index === 0 && tier === 1;
            path.style.animationPlayState = animate ? "running" : "paused";
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE helpers
// ═══════════════════════════════════════════════════════════════════

/** Build a per-region category map: picks the category from the most-recent event per region.
 *  If a region has multiple event types, the one with the lowest tier (most urgent) wins.
 */
function _buildCategoryByRegion(events) {
    const result = {};
    events.forEach(ev => {
        if (!ev.regionId) return;
        const existing = result[ev.regionId];
        const evTier = categoryTier(ev.category);
        const exTier = existing ? categoryTier(existing.category) : 99;
        // Lower tier wins; ties broken by most-recent timestamp
        if (!existing || evTier < exTier || (evTier === exTier && ev.timestamp > existing.timestamp)) {
            result[ev.regionId] = { category: ev.category, timestamp: ev.timestamp };
        }
    });
    return result;
}

/** Top event for region — picks lowest tier (most urgent), then most recent. */
function _topEventForRegion(regionId, events) {
    return events
        .filter(e => e.regionId === regionId)
        .sort((a, b) => {
            const td = categoryTier(a.category) - categoryTier(b.category);
            if (td !== 0) return td;
            return b.timestamp.localeCompare(a.timestamp);
        })[0] ?? null;
}

function _idFromLayer(layer) {
    for (const [id, l] of _regionLayerMap.entries()) {
        if (l === layer) return id;
    }
    return null;
}

function _applyCatClass(path, category) {
    path.classList.remove(
        "cat-health-path", "cat-infrastructure-path", "cat-mobility-path",
        "cat-safety-path", "cat-weather-path", "cat-emergency-path"
    );
    path.classList.add(`cat-${category}-path`);
}

function _suspendAnimations() {
    _regionLayerMap.forEach(layer => {
        if (layer._path) layer._path.style.animationPlayState = "paused";
    });
}

function _updatePerfCounter(ms) {
    if (ms > 20) {
        _ctx.state.consecutiveSlowFrames = (_ctx.state.consecutiveSlowFrames ?? 0) + 1;
    } else {
        _ctx.state.consecutiveSlowFrames = 0;
    }
    if (_ctx.state.consecutiveSlowFrames >= 3) {
        console.warn("[V4] Arbitration slow ×3 — disabling env overlays.");
        _ctx.state.envOverlaysEnabled = false;
        _ctx.emit("perf:envDisabled", {});
    }
}

function _effectiveTierCeiling(ms) {
    if (ms > 20 || _ctx.state.isHistorical) return 1;
    if (ms > 16) return 1;
    return 2;
}
