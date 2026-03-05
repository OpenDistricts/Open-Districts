// ─── MAP CONTROLLER - v4-app.js extraction ────────────────────────────────────
// Owns: Leaflet init (ONCE), GeoJSON layer management, animation arbitration.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { loadDistrictGeo, syncFocus, syncModeClass, runArbitration }
// ─────────────────────────────────────────────────────────────────────────────

import {
    boundingBoxToLeaflet, categoryMarkerOptions, categoryPolygonStyle, districtBoundaryStyle, categoryTier,
    getCategoryDisplayPriority, getCategoryColor, buildMarkerIconHtml
} from '../services/geo-service.js';
import { fuzzyMatch } from '../utils/string-matcher.js';

let _ctx;

// ── Leaflet handles (module-scoped, not on AppState) ──────────────
let _map;
let _boundaryLayer, _regionsLayer, _markersLayer, _maskLayer;
const _regionLayerMap = new Map(); // regionId → Leaflet layer
const MARKER_ICON_SIZE = 36;
const MARKER_ICON_ANCHOR = 18;

// ═══════════════════════════════════════════════════════════════════
// INIT - called ONCE at boot
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

    // ── Layer z-order panes (lowest → highest render order) ───────────────────
    // polygon_fill (401) < hotspot (402) < diffusion (403) < radial (404)
    //   < corridor (450) < eventMarkerPane (460) < default markerPane (600)
    const _pane = (name, z) => { _map.createPane(name).style.zIndex = String(z); };
    _pane('polygonFillPane', 401);
    _pane('hotspotPane',     402);
    _pane('diffusionPane',   403);
    _pane('radialPane',      404);
    _pane('corridorPane',    450);
    _pane('eventMarkerPane', 460);
    // maskClipPane sits above all event panes so that events whose geoPoint
    // falls outside the district polygon hole are correctly hidden by the gray
    // exterior mask.  boundaryPane sits just above it so the district outline
    // ring is always visible on top of the mask.
    _pane('maskClipPane',    590);
    _pane('boundaryPane',    595);

    // Custom zoom buttons (Continuous zooming on hold)
    const setupSmoothZoom = (id, delta) => {
        const btn = document.getElementById(id);
        let zoomInterval;
        const startZoom = (e) => {
            if (e.cancelable) e.preventDefault(); // prevent double tap zoom/selection on mobile
            if (zoomInterval) return;

            // Initial jump (standard click behavior)
            _map.setZoom(_map.getZoom() + (delta * 2.5), { animate: true });

            // Continuous scale
            zoomInterval = setInterval(() => {
                _map.setZoom(_map.getZoom() + delta, { animate: false });
            }, 60);
        };
        const stopZoom = () => {
            clearInterval(zoomInterval);
            zoomInterval = null;
        };

        btn.addEventListener("mousedown", startZoom);
        btn.addEventListener("touchstart", startZoom, { passive: false });
        btn.addEventListener("mouseup", stopZoom);
        btn.addEventListener("mouseleave", stopZoom);
        btn.addEventListener("touchend", stopZoom);
        btn.addEventListener("touchcancel", stopZoom);

        // Keyboard accessibility
        btn.addEventListener("click", (e) => {
            if (e.detail === 0) _map.setZoom(_map.getZoom() + (delta * 2.5), { animate: true });
        });
    };

    setupSmoothZoom("zoom-in", 0.15);
    setupSmoothZoom("zoom-out", -0.15);

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

    // Lock Focus toggle (default locked/on based on HTML change)
    lockCheckbox.addEventListener("change", (e) => {
        setLockState(e.target.checked);
    });

    // Initialize lock state to true (default) based on HTML checked attribute
    if (lockCheckbox && lockCheckbox.checked) {
        setLockState(true);
    }
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
    if (_boundaryLayer) {
        _map.removeLayer(_boundaryLayer);
        _boundaryLayer = null;
    }
    if (_regionsLayer) {
        _map.removeLayer(_regionsLayer);
        _regionsLayer = null;
    }
    if (_markersLayer) {
        _map.removeLayer(_markersLayer);
        _markersLayer = null;
    }
    if (_maskLayer) {
        _map.removeLayer(_maskLayer);
        _maskLayer = null;
    }
    _regionLayerMap.clear();

    const lockCheckbox = document.getElementById("lock-map-focus");
    const shouldLockFocus = lockCheckbox ? lockCheckbox.checked : false;

    // Important: release previous district constraints first, otherwise fitBounds
    // can get clamped to the old district and land in the wrong location.
    _map.setMaxBounds(null);
    _map.setMinZoom(2);
    _map.setMaxZoom(20);

    // Fit to bounds and strictly cage the user
    // Convert array structure to L.LatLngBounds so we can pad it
    const bounds = L.latLngBounds(boundingBoxToLeaflet(district.boundingBox));
    _map.fitBounds(bounds, { padding: [20, 20] });

    // Try to load GeoJSON - falls back to mock grid in geo-service
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

    console.log(`[MAP DEBUG] Punching mask holes. Features: ${punchData.features.length}, Unified: ${!!unifiedDistrict}`);

    punchData.features.forEach((f, idx) => {
        if (!f.geometry || !f.geometry.coordinates) return;

        try {
            // Use Leaflet's own GeoJSON coordinate parser to be 100% safe
            const latlngs = L.GeoJSON.coordsToLatLngs(f.geometry.coordinates, (f.geometry.type === "MultiPolygon" ? 2 : 1));

            if (f.geometry.type === "Polygon") {
                maskCoordinates.push(latlngs[0]);
                console.log(`[MAP DEBUG] Punched Polygon hole ${idx}`);
            } else if (f.geometry.type === "MultiPolygon") {
                latlngs.forEach((parts, pIdx) => {
                    maskCoordinates.push(parts[0]);
                    console.log(`[MAP DEBUG] Punched MultiPolygon part hole ${idx}.${pIdx}`);
                });
            }
        } catch (err) {
            console.error("[MAP] Failed to extract coordinates for mask hole", err);
        }
    });

    console.log(`[MAP DEBUG] Total rings in _maskLayer: ${maskCoordinates.length} (incl. world)`);

    _maskLayer = L.polygon(maskCoordinates, {
        fillColor: '#DDE1E7', // --map-base
        fillOpacity: 0.8,
        stroke: false,
        className: 'focus-mask-layer',
        interactive: false,
        pane: 'maskClipPane',   // above all event panes (460) — clips visual bleed
    }); // Do not add to map by default

    // District boundary ring (using unified outer border if available)
    _boundaryLayer = L.geoJSON(punchData, {
        style: { ...districtBoundaryStyle(), pane: 'boundaryPane' },
        interactive: false,
    }).addTo(_map);

    // Sub-district polygons
    _regionsLayer = L.geoJSON(geoData, {
        style: feature => {
            const regionId = feature.properties?.id ?? feature.id ?? "";
            const entry = categoryMap[regionId];
            const isRegionFill = entry && (entry.impactScale === "WIDE" || entry.renderAs === "polygon_fill");
            const cat = isRegionFill ? entry.category : "none";
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
            const cat = (entry && (entry.impactScale === "WIDE" || entry.renderAs === "polygon_fill")) ? entry.category : "none";
            if (cat !== "none") {
                _applyCatClass(layer._path, cat);
            }
            if (!layer._path.classList.contains("polygon-path")) layer._path.classList.add("polygon-path");
        });
        runArbitration();
    }, 120);

    // Point markers - renderAs-aware ──────────────────────────────────────────
    const group = L.featureGroup();

    /** Infer renderAs from schema fields when the field is absent. */
    const _inferRenderAs = (ev) => {
        if (ev.renderAs) return ev.renderAs;
        switch (ev.impactScale) {
            case 'POINT': return 'marker';
            case 'LOCAL':
                if (ev.meta?.multiPoints?.length || ev.meta?.clusterPoints?.length) return 'multi_marker';
                if (ev.meta?.radiusMetres) return 'radial';
                if (ev.meta?.heatPoints?.length) return 'hotspot';
                return 'marker';
            case 'WIDE':
                if (ev.meta?.pathCoords?.length) return 'corridor';
                if (ev.meta?.heatPoints?.length) return 'hotspot';
                if (ev.regionId || ev.regionIds?.length) return 'polygon_fill';
                if (ev.meta?.multiPoints?.length || ev.meta?.clusterPoints?.length) return 'multi_marker';
                return 'marker';
            case 'STATE': return ev.meta?.heatPoints ? 'hotspot' : ((ev.regionId || ev.regionIds?.length) ? 'polygon_fill' : 'hotspot');
            default:      return 'marker';
        }
    };

    /** Build a DivIcon L.Marker and register all shared event handlers. */
    const _makeIconMarker = (ev, latLng, tooltipText, dimmed = false) => {
        const m = L.marker(latLng, {
            icon: L.divIcon({
                html: buildMarkerIconHtml(ev, dimmed),
                className: 'od-event-marker-host',
                iconSize: [MARKER_ICON_SIZE, MARKER_ICON_SIZE],
                iconAnchor: [MARKER_ICON_ANCHOR, MARKER_ICON_ANCHOR],
                tooltipAnchor: [MARKER_ICON_ANCHOR, -MARKER_ICON_ANCHOR],
            }),
            pane: 'eventMarkerPane',
        });
        m.bindTooltip(tooltipText ?? ev.title, { sticky: true });
        m.on('click', () => _ctx.emit('map:regionClick', { eventId: ev.id }));
        m.eventId = ev.id;
        m.category = ev.category;
        m.impactScale = ev.impactScale;
        m.renderAs = ev.renderAs ?? _inferRenderAs(ev);
        return m;
    };

    events.forEach(ev => {
        const renderAs = _inferRenderAs(ev);
        const color = getCategoryColor(ev.category);
        const h = { hex: color };  // lightweight accessor used for circle layers

        switch (renderAs) {

            case 'marker': {
                if (!ev.geoPoint) break;
                group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                break;
            }

            case 'multi_marker': {
                const pts = ev.meta?.multiPoints ?? ev.meta?.clusterPoints;  // legacy alias
                if (!pts?.length) {
                    if (ev.geoPoint) group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                    break;
                }
                // One DivIcon per site
                pts.forEach(pt => {
                    const label = pt.label ? `${ev.title} - ${pt.label}` : ev.title;
                    group.addLayer(_makeIconMarker(ev, [pt.lat, pt.lng], label));
                });
                // Dashed bounding circle around the cluster
                const llBounds = L.latLngBounds(pts.map(p => [p.lat, p.lng]));
                const center = llBounds.getCenter();
                let maxDist = 0;
                pts.forEach(p => { const d = center.distanceTo(L.latLng(p.lat, p.lng)); if (d > maxDist) maxDist = d; });
                const boundCircle = L.circle(center, {
                    radius: Math.max(maxDist * 1.25, 250),
                    color, fillColor: 'transparent', fillOpacity: 0,
                    weight: 1.5, opacity: 0.4, dashArray: '4 6',
                    pane: 'radialPane', interactive: false,
                });
                boundCircle.eventId = ev.id;
                group.addLayer(boundCircle);
                break;
            }

            case 'radial': {
                if (!ev.geoPoint || !ev.meta?.radiusMetres) {
                    if (ev.geoPoint) group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                    break;
                }
                const isEst = ev.meta.radiusConfidence === 'estimated';
                const circle = L.circle([ev.geoPoint.lat, ev.geoPoint.lng], {
                    color, fillColor: color,
                    fillOpacity: 0.08,
                    weight: ev.meta.cordonActive ? 3 : (isEst ? 1.5 : 2),
                    opacity: ev.meta.cordonActive ? 0.9 : 0.7,
                    dashArray: isEst ? '6 4' : null,
                    radius: ev.meta.radiusMetres,
                    pane: 'radialPane',
                });
                circle.bindTooltip(ev.title, { sticky: true });
                circle.on('click', () => _ctx.emit('map:regionClick', { eventId: ev.id }));
                circle.eventId = ev.id; circle.category = ev.category;
                circle.impactScale = ev.impactScale; circle.renderAs = renderAs;
                group.addLayer(circle);
                group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                break;
            }

            case 'diffusion': {
                if (!ev.geoPoint || !ev.meta?.radiusMetres) {
                    if (ev.geoPoint) group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                    break;
                }
                const r = ev.meta.radiusMetres;
                // Soft tint + glow avoids the hard red-disc look.
                [[r, 0.12], [r * 0.62, 0.08]].forEach(([radius, fillOpacity]) => {
                    const c = L.circle([ev.geoPoint.lat, ev.geoPoint.lng], {
                        color: 'transparent', fillColor: color, fillOpacity,
                        weight: 0, radius, pane: 'diffusionPane', interactive: false,
                        className: 'od-soft-diffusion',
                    });
                    c.eventId = ev.id;
                    group.addLayer(c);
                });
                const edgeGlow = L.circle([ev.geoPoint.lat, ev.geoPoint.lng], {
                    color, fillColor: 'transparent', fillOpacity: 0,
                    weight: 3, opacity: 0.25,
                    radius: r, pane: 'diffusionPane', interactive: false,
                    className: 'od-soft-diffusion-edge',
                });
                edgeGlow.eventId = ev.id;
                group.addLayer(edgeGlow);
                // Outer dashed boundary ring (clickable / tooltip)
                const outerRing = L.circle([ev.geoPoint.lat, ev.geoPoint.lng], {
                    color, fillColor: 'transparent', fillOpacity: 0,
                    weight: 1, opacity: 0.4, dashArray: '4 5',
                    radius: r, pane: 'diffusionPane',
                });
                outerRing.bindTooltip(ev.title, { sticky: true });
                outerRing.on('click', () => _ctx.emit('map:regionClick', { eventId: ev.id }));
                outerRing.eventId = ev.id; outerRing.category = ev.category;
                outerRing.impactScale = ev.impactScale; outerRing.renderAs = renderAs;
                group.addLayer(outerRing);
                group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                break;
            }

            case 'corridor': {
                // Basic map mode: the raw polyline conveys no meaningful direction
                // to a general audience. Render only the icon marker at the path
                // start (or at geoPoint if coords are absent). The advanced
                // effects controller applies the ROAD_BUILD/corridor overlays
                // separately in advanced mode.
                const coords = ev.meta?.pathCoords;
                if (coords?.length) {
                    group.addLayer(_makeIconMarker(ev, [coords[0].lat, coords[0].lng]));
                } else if (ev.geoPoint) {
                    group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                }
                break;
            }

            case 'hotspot': {
                const pts = ev.meta?.heatPoints;
                if (!pts?.length) {
                    if (ev.geoPoint) group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                    break;
                }
                const radius = ev.meta?.heatRadius ?? 1000;
                pts.forEach(pt => {
                    const intensity = Math.max(0.05, Math.min(1, pt.intensity ?? 0.5));
                    // Approximate gaussian falloff using stacked circles.
                    [[1.0, 0.08], [0.74, 0.11], [0.5, 0.14], [0.28, 0.17]].forEach(([m, baseAlpha]) => {
                        const c = L.circle([pt.lat, pt.lng], {
                            radius: radius * m,
                            color: 'transparent',
                            fillColor: color,
                            fillOpacity: Math.min(0.22, intensity * baseAlpha),
                            weight: 0,
                            pane: 'hotspotPane',
                            interactive: false,
                        });
                        c.eventId = ev.id;
                        group.addLayer(c);
                    });
                });
                if (ev.geoPoint) group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                break;
            }

            case 'polygon_fill':
                // Handled by _regionsLayer when regionId/regionIds are available.
                if (!ev.regionId && !ev.regionIds?.length && ev.geoPoint) {
                    group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                }
                break;

            default: {
                if (ev.geoPoint) group.addLayer(_makeIconMarker(ev, [ev.geoPoint.lat, ev.geoPoint.lng]));
                break;
            }
        }
    });
    _markersLayer = group.addTo(_map);

    // Re-apply lock after rebuilding layers/mask for the new district.
    setLockState(shouldLockFocus);
    if (shouldLockFocus) {
        _map.fitBounds(bounds, { padding: [20, 20] });
    }
}

/** Highlight focused polygon, dim others, fly to bounds. */
export function syncFocus(focusedEventId, events) {
    const categoryMap = _buildCategoryByRegion(events);

    if (!focusedEventId) {
        _regionLayerMap.forEach((layer, regionId) => {
            const entry = categoryMap[regionId];
            const cat = (entry && (entry.impactScale === "WIDE" || entry.renderAs === "polygon_fill")) ? entry.category : "none";
            layer.setStyle(categoryPolygonStyle(cat, false, false));
        });
        if (_markersLayer) {
            _markersLayer.eachLayer(layer => {
                const markerEv = events.find(e => e.id === layer.eventId);
                if (!markerEv) return;
                if (layer instanceof L.Marker) {
                    layer.setIcon(L.divIcon({
                        html: buildMarkerIconHtml(markerEv, false),
                        className: 'od-event-marker-host',
                        iconSize: [MARKER_ICON_SIZE, MARKER_ICON_SIZE],
                        iconAnchor: [MARKER_ICON_ANCHOR, MARKER_ICON_ANCHOR],
                    }));
                } else {
                    layer.setStyle(categoryMarkerOptions(markerEv.category, false));
                }
            });
        }
        setTimeout(runArbitration, 100); // Ensure arbitration runs after potential map movement
        return;
    }

    const ev = events.find(e => e.id === focusedEventId);
    if (!ev) {
        // Resetting focus
        _regionLayerMap.forEach((layer, regionId) => {
            const entry = categoryMap[regionId];
            const cat = (entry && (entry.impactScale === "WIDE" || entry.renderAs === "polygon_fill")) ? entry.category : "none";
            layer.setStyle(categoryPolygonStyle(cat, false, false));
        });
        if (_markersLayer) {
            _markersLayer.eachLayer(layer => {
                const markerEv = events.find(e => e.id === layer.eventId);
                if (!markerEv) return;
                if (layer instanceof L.Marker) {
                    layer.setIcon(L.divIcon({
                        html: buildMarkerIconHtml(markerEv, false),
                        className: 'od-event-marker-host',
                        iconSize: [MARKER_ICON_SIZE, MARKER_ICON_SIZE],
                        iconAnchor: [MARKER_ICON_ANCHOR, MARKER_ICON_ANCHOR],
                    }));
                } else {
                    layer.setStyle(categoryMarkerOptions(markerEv.category, false));
                }
            });
        }
        setTimeout(runArbitration, 100);
        return;
    }

    const focusedRegionIds = [...new Set(
        (Array.isArray(ev.regionIds) && ev.regionIds.length ? ev.regionIds : (ev.regionId ? [ev.regionId] : []))
            .filter((regionId) => typeof regionId === "string" && regionId)
    )];
    const focusedRegionSet = new Set(focusedRegionIds);

    // Fly to event
    const targetLayer = focusedRegionIds
        .map((regionId) => _regionLayerMap.get(regionId))
        .find(Boolean) ?? null;

    if (ev.meta?.multiPoints && ev.meta.multiPoints.length > 0) {
        const bounds = L.latLngBounds(ev.meta.multiPoints.map(pt => [pt.lat, pt.lng]));
        _map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
    else if (ev.meta?.clusterPoints && ev.meta.clusterPoints.length > 0) {
        // Legacy clusterPoints support
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
    else if (focusedRegionIds.length > 1) {
        let unionBounds = null;
        focusedRegionIds.forEach((regionId) => {
            const layer = _regionLayerMap.get(regionId);
            if (!layer?.getBounds) return;
            const b = layer.getBounds();
            if (!unionBounds) {
                unionBounds = L.latLngBounds(b.getSouthWest(), b.getNorthEast());
            } else {
                unionBounds.extend(b);
            }
        });
        if (unionBounds?.isValid?.()) {
            _map.fitBounds(unionBounds, { padding: [30, 30] });
        }
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

        if ((ev.impactScale === "WIDE" || ev.renderAs === "polygon_fill") && focusedRegionSet.has(regionId)) {
            cat = ev.category;
            isFocusedPoly = true;
            isDimmed = false;
        } else if (entry && (entry.impactScale === "WIDE" || entry.renderAs === "polygon_fill")) {
            cat = entry.category;
        }

        layer.setStyle(categoryPolygonStyle(cat, isFocusedPoly, isDimmed));
    });

    if (_markersLayer) {
        _markersLayer.eachLayer(layer => {
            const isFocused = layer.eventId === focusedEventId;
            const markerEv = events.find(e => e.id === layer.eventId);
            if (!markerEv) return;
            if (layer instanceof L.Marker) {
                layer.setIcon(L.divIcon({
                    html: buildMarkerIconHtml(markerEv, !isFocused),
                    className: 'od-event-marker-host',
                    iconSize: [MARKER_ICON_SIZE, MARKER_ICON_SIZE],
                    iconAnchor: [MARKER_ICON_ANCHOR, MARKER_ICON_ANCHOR],
                }));
            } else {
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

export function getMapInstance() {
    return _map;
}

/** Recenter map to district bounds (used after district-switch focus resets). */
export function recenterToDistrict(district, padding = [20, 20]) {
    if (!district?.boundingBox) return;
    const bounds = L.latLngBounds(boundingBoxToLeaflet(district.boundingBox));
    _map.fitBounds(bounds, { padding });
}

/** Update map layers to reflect a historical snapshot up to bucketIndex. */
export function applyHistoricalSnapshot(bucketIndex, timeBuckets, events) {
    if (!_regionsLayer) return;

    const bucket = timeBuckets[bucketIndex];
    if (!bucket) return;

    const endTs = new Date(bucket.endTs);
    const startTs = bucket.startTs ? new Date(bucket.startTs) : null;

    // Partition events into: current-bucket, historical, and future
    const currentBucketEvts = events.filter(e => {
        const t = new Date(e.timestamp);
        return t <= endTs && (!startTs || t >= startTs);
    });
    const historicalEvts = events.filter(e => {
        const t = new Date(e.timestamp);
        return t <= endTs && startTs && t < startTs;
    });
    const futureEvts = events.filter(e => new Date(e.timestamp) > endTs);

    const currentCatMap = _buildCategoryByRegion(currentBucketEvts);
    const historicalCatMap = _buildCategoryByRegion([...historicalEvts, ...currentBucketEvts]);

    // Polygon regions
    _regionLayerMap.forEach((layer, regionId) => {
        const current = currentCatMap[regionId];
        const historical = historicalCatMap[regionId];

        if (current && (current.impactScale === "WIDE" || current.renderAs === "polygon_fill")) {
            // Active in this bucket - full highlight
            const cat = current.category;
            layer.setStyle({ ...categoryPolygonStyle(cat, false), opacity: 0.25, fillOpacity: 0.12 });
            if (layer._path) _applyCatClass(layer._path, cat);
        } else if (historical && (historical.impactScale === "WIDE" || historical.renderAs === "polygon_fill")) {
            // Past event - keep but dim
            const cat = historical.category;
            layer.setStyle({ ...categoryPolygonStyle(cat, false), opacity: 0.18, fillOpacity: 0.07 });
            if (layer._path) _applyCatClass(layer._path, cat);
        } else {
            // No event or future event - clear
            layer.setStyle(categoryPolygonStyle("none", false));
            if (layer._path) _applyCatClass(layer._path, "none");
        }
    });

    // Point/Local markers
    if (_markersLayer) {
        _markersLayer.eachLayer(layer => {
            const ev = events.find(e => e.id === layer.eventId);
            if (!ev) return;

            const evTs = new Date(ev.timestamp);
            const show = evTs <= endTs;
            const isCurrent = startTs ? evTs >= startTs : false;
            const opacity = show ? (isCurrent ? '1' : '0.25') : null;

            // DivIcon L.Marker - use getElement() for visibility
            if (layer instanceof L.Marker) {
                const el = layer.getElement?.();
                if (el) el.style.opacity = show ? (isCurrent ? '1' : '0.25') : '0';
                return;
            }

            if (!layer._path) return;
            if (!show) {
                layer._path.style.display = "none";
            } else {
                layer._path.style.display = "";
                layer._path.style.opacity = isCurrent ? "1" : "0.25";
            }
        });
    }

    runArbitration();
}

/** Remove all temporal visibility filters and return features to default live appearance */
export function clearHistoricalSnapshot(events) {
    if (!_regionsLayer) return;

    // Build the category map for ALL events currently known
    const categoryMap = _buildCategoryByRegion(events || []);

    // Polygons
    _regionLayerMap.forEach((layer, regionId) => {
        const entry = categoryMap[regionId];
        const cat = (entry && (entry.impactScale === "WIDE" || entry.renderAs === "polygon_fill")) ? entry.category : "none";

        layer.setStyle({ ...categoryPolygonStyle(cat, false), opacity: 0.25, fillOpacity: 0.12 });
        if (layer._path && cat !== "none") {
            _applyCatClass(layer._path, cat);
        } else if (layer._path) {
            _applyCatClass(layer._path, "none");
        }
    });

    // Markers
    if (_markersLayer) {
        _markersLayer.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                const el = layer.getElement?.();
                if (el) el.style.opacity = '1';
                return;
            }
            if (layer._path) {
                layer._path.style.display = "";
                layer._path.style.opacity = "1";
            }
        });
    }

    runArbitration();
}

/** Arbitration engine - governs all polygon animation play-state. */
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
        if (entry && (entry.impactScale === "WIDE" || entry.renderAs === "polygon_fill")) {
            const priority = getCategoryDisplayPriority(entry.category, entry.displayPriority);
            visibleItems.push({ layer, category: entry.category, priority, timestamp: entry.timestamp });
        }
    });

    // 2. LOCAL and POINT events (Markers/Circles/Polylines)
    if (_markersLayer) {
        _markersLayer.eachLayer(layer => {
            // L.Polyline (corridor) - use bounds intersection, no path animation
            if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                return; // corridors don't participate in CSS pulse arbitration
            }
            const latLng = layer.getLatLng?.();
            if (!latLng || !mapBounds.contains(latLng)) return;
            const ev = events.find(e => e.id === layer.eventId);
            if (ev && (ev.impactScale === "POINT" || ev.impactScale === "LOCAL")) {
                const priority = getCategoryDisplayPriority(ev.category, ev.displayPriority);
                visibleItems.push({ layer, category: ev.category, priority, timestamp: ev.timestamp });
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

    // Sort: priority asc (1 = emergency wins), ties broken by newest timestamp
    visibleItems.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const elapsed = performance.now() - t0;
    _updatePerfCounter(elapsed);
    const maxTier = _effectiveTierCeiling(elapsed);

    visibleItems.forEach(({ layer, category, priority }, index) => {
        // DivIcon L.Marker - no SVG path, skip path-based animation
        if (layer instanceof L.Marker) return;
        if (!layer._path) return;
        const path = layer._path;

        // Ensure marker/polygon path classes for CSS selection
        if (layer instanceof L.CircleMarker || layer instanceof L.Circle) {
            if (!path.classList.contains("marker-path")) path.classList.add("marker-path");
        } else {
            if (!path.classList.contains("polygon-path")) path.classList.add("polygon-path");
        }

        if (isLive) {
            // priority 1-2 (emergency, safety) → tier-1 animation slot
            // priority 3-4 (weather, health)   → tier-2 animation slot
            const isTier1Slot = priority <= 2 && index === 0 && maxTier >= 1;
            const isTier2Slot = priority >= 3 && priority <= 4 && index >= 1 && index <= 2 && maxTier >= 2;

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
 *  If a region has multiple event types, the one with the lowest displayPriority wins.
 *  displayPriority from the event overrides the category default.
 */
function _buildCategoryByRegion(events) {
    const result = {};
    events.forEach(ev => {
        const regionIds = Array.isArray(ev.regionIds) && ev.regionIds.length
            ? ev.regionIds
            : (ev.regionId ? [ev.regionId] : []);
        if (!regionIds.length) return;
        regionIds.forEach((regionId) => {
            const existing = result[regionId];
            const evPri = getCategoryDisplayPriority(ev.category, ev.displayPriority);
            const exPri = existing ? getCategoryDisplayPriority(existing.category, existing.displayPriority) : 99;
            if (!existing || evPri < exPri || (evPri === exPri && ev.timestamp > existing.timestamp)) {
                result[regionId] = {
                    category: ev.category,
                    timestamp: ev.timestamp,
                    impactScale: ev.impactScale,
                    renderAs: ev.renderAs,
                    displayPriority: ev.displayPriority,
                    eventId: ev.id
                };
            }
        });
    });
    return result;
}

/** Top event for region - picks lowest displayPriority (most urgent), then most recent. */
function _topEventForRegion(regionId, events) {
    return events
        .filter(e => e.regionId === regionId || (Array.isArray(e.regionIds) && e.regionIds.includes(regionId)))
        .sort((a, b) => {
            const pa = getCategoryDisplayPriority(a.category, a.displayPriority);
            const pb = getCategoryDisplayPriority(b.category, b.displayPriority);
            if (pa !== pb) return pa - pb;
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
        console.warn("[V4] Arbitration slow ×3 - disabling env overlays.");
        _ctx.state.envOverlaysEnabled = false;
        _ctx.emit("perf:envDisabled", {});
    }
}

function _effectiveTierCeiling(ms) {
    if (ms > 20 || _ctx.state.isHistorical) return 1;
    if (ms > 16) return 1;
    return 2;
}
