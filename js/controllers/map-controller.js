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

    let _arbitrationTimer;

    // Pan lifecycle → auto-hide timeline + arbitration suspension
    _map.on("movestart", () => {
        _ctx.state.isPanning = true;
        if (!_ctx.state.manuallyCollapsed) {
            document.getElementById("timeline-panel").classList.add("hidden");
        }
        _suspendAnimations();
        clearTimeout(_ctx.state.autoHideTimer);
        clearTimeout(_arbitrationTimer);
    });

    _map.on("moveend", () => {
        clearTimeout(_ctx.state.autoHideTimer);
        _ctx.state.autoHideTimer = setTimeout(() => {
            if (!_ctx.state.manuallyCollapsed) {
                document.getElementById("timeline-panel").classList.remove("hidden");
            }
        }, _ctx.state.manuallyCollapsed ? 300 : 500);

        clearTimeout(_arbitrationTimer);
        _arbitrationTimer = setTimeout(() => {
            _ctx.state.isPanning = false;
            runArbitration();
        }, 300);
    });

    _setupMapControls();
}

let _userMarker;

function _setupMapControls() {
    const settingsPanel = document.getElementById("settings-panel");
    const settingsTab = document.getElementById("settings-tab");
    const lockCheckbox = document.getElementById("lock-map-focus");

    // Toggle Settings Sidebar
    const toggleSettings = () => {
        const isHidden = settingsPanel.classList.contains("hidden");
        if (isHidden) {
            settingsPanel.classList.remove("hidden");
            settingsTab.setAttribute("aria-expanded", "true");
        } else {
            settingsPanel.classList.add("hidden");
            settingsTab.setAttribute("aria-expanded", "false");
        }
    };

    settingsTab.addEventListener("click", toggleSettings);

    // Lock Focus toggle (default unlocked/off based on HTML change)
    lockCheckbox.addEventListener("change", (e) => {
        setLockState(e.target.checked);
    });
}
function setLockState(isLocked) {
    if (!isLocked) {
        // Unlock
        _map.setMaxBounds(null);
        _map.setMinZoom(2); // Global scale zoom out permitted
        _map.setMaxZoom(20);
        if (_maskLayer && _map.hasLayer(_maskLayer)) {
            _map.removeLayer(_maskLayer);
        }
    } else {
        // Lock to current district boundaries in AppState
        if (_ctx.state.currentDistrict) {
            const bounds = L.latLngBounds(boundingBoxToLeaflet(_ctx.state.currentDistrict.boundingBox));
            const padBounds = bounds.pad(0.05);
            _map.setMaxBounds(padBounds);
            _map.setMinZoom(_map.getBoundsZoom(padBounds, false));
            _map.setMaxZoom(19);
        }
        if (_maskLayer && !_map.hasLayer(_maskLayer)) {
            _map.addLayer(_maskLayer);
        }
    }
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

    // Construct a singular outer polygon (merge all sub-regions) for the boundary ring and the exterior mask.
    let unifiedDistrict = null;
    try {
        if (typeof turf !== 'undefined' && geoData.features.length > 0) {
            unifiedDistrict = JSON.parse(JSON.stringify(geoData.features[0]));
            for (let i = 1; i < geoData.features.length; i++) {
                const result = turf.union(unifiedDistrict, geoData.features[i]);
                if (result) unifiedDistrict = result;
            }
        }
    } catch (e) {
        console.warn("[MAP] Failed to union polygons with turf. Falling back to multi-feature mask.", e);
    }

    // Create an inverted polygon to mask out everything outside the district
    const maskCoordinates = [
        [[90, -180], [90, 180], [-90, 180], [-90, -180]]
    ];

    const punchData = unifiedDistrict ? { type: "FeatureCollection", features: [unifiedDistrict] } : geoData;

    // Direct GeoJSON coordinate extraction (more robust than Leaflet Layer inspection)
    const swap = (arr) => {
        if (typeof arr[0] === 'number') return [arr[1], arr[0]];
        return arr.map(swap);
    };

    punchData.features.forEach(f => {
        if (!f.geometry) return;
        if (f.geometry.type === "Polygon") {
            maskCoordinates.push(swap(f.geometry.coordinates)[0]);
        } else if (f.geometry.type === "MultiPolygon") {
            swap(f.geometry.coordinates).forEach(poly => maskCoordinates.push(poly[0]));
        }
    });

    _maskLayer = L.polygon(maskCoordinates, {
        fillColor: '#DDE1E7', // --map-base
        fillOpacity: 0.8,
        stroke: false,
        interactive: false
    }); // Do not add to map by default

    // District boundary ring (using unified outer border if available)
    _boundaryLayer = L.geoJSON(punchData, {
        style: districtBoundaryStyle(),
        interactive: false,
    }).addTo(_map);

    // Sub-district polygons
    _regionsLayer = L.geoJSON(geoData, {
        style: feature => {
            const regionId = feature.properties?.id ?? feature.id ?? "";
            const entry = categoryMap[regionId];
            const cat = (entry && entry.impactScale === "WIDE") ? entry.category : "none";
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
            const entry = categoryMap[regionId];
            const cat = (entry && entry.impactScale === "WIDE") ? entry.category : "none";
            if (cat !== "none") {
                _applyCatClass(layer._path, cat);
            }
            if (!layer._path.classList.contains("polygon-path")) layer._path.classList.add("polygon-path");
        });
        runArbitration();
    }, 120);

    // Point markers
    const group = L.featureGroup();
    events.forEach(ev => {
        const opts = categoryMarkerOptions(ev.category);

        const createMarker = (latLng, isCluster = false) => {
            let marker;
            if (ev.impactScale === "LOCAL" && ev.meta?.radiusMetres && !isCluster) {
                // Draw a precise data-driven circle for local events
                marker = L.circle(latLng, {
                    color: opts.color,
                    fillColor: opts.fillColor,
                    fillOpacity: opts.fillOpacity * 0.5,
                    weight: opts.weight,
                    radius: ev.meta.radiusMetres
                });
            } else {
                // Point, Wide, or Cluster uses a standard circleMarker
                marker = L.circleMarker(latLng, opts);
            }

            marker.bindTooltip(ev.title, { sticky: true });
            marker.on("click", () => _ctx.emit("map:regionClick", { eventId: ev.id }));

            // Attach properties for animation arbitration
            marker.eventId = ev.id;
            marker.category = ev.category;
            marker.impactScale = ev.impactScale;
            marker.isClusterPoint = isCluster;

            group.addLayer(marker);
        };

        // Render clusters if present, otherwise render the single event center
        if (ev.meta?.clusterPoints && ev.meta.clusterPoints.length > 0) {
            ev.meta.clusterPoints.forEach(pt => createMarker([pt.lat, pt.lng], true));
        } else if (ev.geoPoint) {
            createMarker([ev.geoPoint.lat, ev.geoPoint.lng], false);
        }
    });
    _markersLayer = group.addTo(_map);

    // Sync lock state with UI toggle
    const lockCheckbox = document.getElementById("lock-map-focus");
    setLockState(lockCheckbox ? lockCheckbox.checked : false);
}

/** Highlight focused polygon, dim others, fly to bounds. */
export function syncFocus(focusedEventId, events) {
    const categoryMap = _buildCategoryByRegion(events);

    if (!focusedEventId) {
        _regionLayerMap.forEach((layer, regionId) => {
            const entry = categoryMap[regionId];
            const cat = (entry && entry.impactScale === "WIDE") ? entry.category : "none";
            layer.setStyle(categoryPolygonStyle(cat, false));
        });
        setTimeout(runArbitration, 100); // Ensure arbitration runs after potential map movement
        return;
    }

    const ev = events.find(e => e.id === focusedEventId);
    if (!ev) {
        // Resetting focus
        _regionLayerMap.forEach((layer, regionId) => {
            const entry = categoryMap[regionId];
            const cat = (entry && entry.impactScale === "WIDE") ? entry.category : "none";
            layer.setStyle(categoryPolygonStyle(cat, false, false));
        });
        if (_markersLayer) {
            _markersLayer.eachLayer(layer => {
                const markerEv = events.find(e => e.id === layer.eventId);
                if (markerEv) {
                    const opts = categoryMarkerOptions(markerEv.category, false);
                    layer.setStyle(opts);
                }
            });
        }
        setTimeout(runArbitration, 100);
        return;
    }

    // Fly to event
    const targetLayer = ev.regionId ? _regionLayerMap.get(ev.regionId) : null;

    if (ev.meta?.clusterPoints && ev.meta.clusterPoints.length > 0) {
        const bounds = L.latLngBounds(ev.meta.clusterPoints.map(pt => [pt.lat, pt.lng]));
        _map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
    else if (ev.impactScale === "LOCAL" && ev.meta?.radiusMetres && ev.geoPoint) {
        const tempCircle = L.circle([ev.geoPoint.lat, ev.geoPoint.lng], { radius: ev.meta.radiusMetres });
        _map.fitBounds(tempCircle.getBounds(), { padding: [30, 30] });
    }
    else if (ev.geoPoint) {
        _map.flyTo([ev.geoPoint.lat, ev.geoPoint.lng], 14, { duration: 0.8 });
    }
    else if (targetLayer?.getBounds) {
        _map.fitBounds(targetLayer.getBounds(), { padding: [30, 30] });
    }

    // Style update: Dim everything else
    _regionLayerMap.forEach((layer, regionId) => {
        const entry = categoryMap[regionId];
        let cat = "none";
        let isFocusedPoly = false;
        let isDimmed = true;

        if (ev.impactScale === "WIDE" && regionId === ev.regionId) {
            cat = ev.category;
            isFocusedPoly = true;
            isDimmed = false;
        } else if (entry && entry.impactScale === "WIDE") {
            cat = entry.category;
        }

        layer.setStyle(categoryPolygonStyle(cat, isFocusedPoly, isDimmed));
    });

    if (_markersLayer) {
        _markersLayer.eachLayer(layer => {
            const isFocused = layer.eventId === focusedEventId;
            const markerEv = events.find(e => e.id === layer.eventId);
            if (markerEv) {
                const opts = categoryMarkerOptions(markerEv.category, !isFocused);
                layer.setStyle(opts);
            }
        });
    }

    // Arbitration (delay slightly to let fitBounds complete)
    setTimeout(runArbitration, 100);
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
        const entry = categoryMap[regionId];
        const cat = (entry && entry.impactScale === "WIDE") ? entry.category : "none";
        layer.setStyle(categoryPolygonStyle(cat, false));
        if (layer._path && cat !== "none") {
            _applyCatClass(layer._path, cat);
        } else if (layer._path) {
            _applyCatClass(layer._path, "none");
        }
    });

    runArbitration();
}

/** Arbitration engine — governs all polygon animation play-state. */
export function runArbitration() {
    if (_ctx.state.isPanning || !_map.getBounds) return;

    const t0 = performance.now();
    const events = _ctx.state.events ?? [];
    const isLive = _ctx.state.mode === "live" && !_ctx.state.isHistorical;
    const mapBounds = _map.getBounds();

    const visibleItems = [];

    // 1. WIDE events (Region polygons)
    const categoryMap = _buildCategoryByRegion(events);
    _regionLayerMap.forEach((layer, regionId) => {
        const center = layer.getBounds?.().getCenter();
        if (!center || !mapBounds.contains(center)) return;
        const entry = categoryMap[regionId];
        if (entry && entry.impactScale === "WIDE") {
            const tier = categoryTier(entry.category);
            visibleItems.push({ layer, category: entry.category, tier, timestamp: entry.timestamp });
        }
    });

    // 2. LOCAL and POINT events (Markers/Circles)
    if (_markersLayer) {
        _markersLayer.eachLayer(layer => {
            const latLng = layer.getLatLng?.();
            if (!latLng || !mapBounds.contains(latLng)) return;
            const ev = events.find(e => e.id === layer.eventId);
            if (ev && (ev.impactScale === "POINT" || ev.impactScale === "LOCAL")) {
                const tier = categoryTier(ev.category);
                visibleItems.push({ layer, category: ev.category, tier, timestamp: ev.timestamp });
            }
            // Ensure the correct CSS class is present for animation styles
            if (layer._path && ev) {
                const targetClass = `cat-${ev.category}-path`;
                if (!layer._path.classList.contains(targetClass)) {
                    _applyCatClass(layer._path, ev.category);
                    layer._path.style.transformOrigin = "center";
                    layer._path.style.transformBox = "fill-box";
                }
            }
        });
    }

    // Sort: tier asc (tier-1 first), then timestamp desc
    visibleItems.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const elapsed = performance.now() - t0;
    _updatePerfCounter(elapsed);
    const maxTier = _effectiveTierCeiling(elapsed);

    visibleItems.forEach(({ layer, category, tier, eventId }, index) => {
        if (!layer._path) return;
        const path = layer._path;

        // Ensure marker/polygon path classes for CSS selection
        if (layer instanceof L.CircleMarker || layer instanceof L.Circle) {
            if (!path.classList.contains("marker-path")) path.classList.add("marker-path");
        } else {
            if (!path.classList.contains("polygon-path")) path.classList.add("polygon-path");
        }

        if (isLive) {
            const isTier1Slot = tier === 1 && index === 0 && maxTier >= 1;
            const isTier2Slot = tier === 2 && index >= 1 && index <= 2 && maxTier >= 2;

            if (isTier1Slot || isTier2Slot) {
                path.style.animationPlayState = "running";
            } else {
                path.style.animationPlayState = "paused";
            }
        } else {
            // District View: No animations for now, explicitly requested.
            path.style.animationPlayState = "paused";
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
            result[ev.regionId] = {
                category: ev.category,
                timestamp: ev.timestamp,
                impactScale: ev.impactScale,
                eventId: ev.id
            };
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
    if (_markersLayer) {
        _markersLayer.eachLayer(layer => {
            if (layer._path) layer._path.style.animationPlayState = "paused";
        });
    }
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
