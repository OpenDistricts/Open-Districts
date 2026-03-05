import { resolveAdvancedEffectsForEvent } from "../services/effect-resolver.js";
import { createQualityManager } from "../services/quality-manager.js";

let _ctx;
let _map;
let _deck;
let _overlayHost;
let _active = false;
let _rafId = null;
let _resolvedEffects = [];
let _timeMs = 0;
let _quality;
let _lastDegradedReason = null;
const _rainSeeds = new Map(); // effectId -> seed points
const _plumeSeeds = new Map(); // effectId -> seed points
const _smogSeeds = new Map(); // effectId -> seed points

const CAT_COLORS = {
    emergency: [232, 78, 86],
    health: [59, 182, 142],
    safety: [61, 177, 182],
    infrastructure: [232, 176, 74],
    mobility: [91, 118, 223],
    weather: [121, 98, 214],
};

const CAT_GLYPHS = {
    emergency: "!",
    health: "+",
    safety: "\u25B3",
    infrastructure: "\u2692",
    mobility: "\u2192",
    weather: "~",
};

export function init(ctx) {
    _ctx = ctx;
    _quality = createQualityManager();
}

export function setMap(mapInstance) {
    _map = mapInstance;
}

export function syncMode({ mode, isHistorical, connectionStatus }) {
    const shouldRun = mode === "live" && !isHistorical && connectionStatus === "live";
    if (!shouldRun) {
        unmount();
        return;
    }
    if (!_mountIfNeeded()) {
        unmount();
        return;
    }
    renderForEvents(_ctx?.state?.events || []);
}

export function renderForEvents(events) {
    if (!_active) return;
    const next = [];
    (events || []).forEach((event) => {
        const resolved = resolveAdvancedEffectsForEvent(event);
        resolved.effects.forEach((fx) => {
            if (!fx.enabled) return;
            next.push(_quality.applyIntensityScale({
                ...fx,
                eventId: event.id,
                category: event.category,
                renderAs: event.renderAs,
                geoPoint: event.geoPoint || null,
                regionId: event.regionId || null,
                regionIds: event.regionIds || [],
                meta: event.meta || {},
            }));
        });
    });
    _resolvedEffects = next;
    _renderFrame();
}

export function suspendForHistorical() {
    unmount();
}

export function unmount() {
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = null;
    if (_map) {
        _map.off("move", _onMapMove);
        _map.off("zoom", _onMapMove);
        _map.off("resize", _onMapMove);
    }
    if (_deck) {
        _deck.finalize();
        _deck = null;
    }
    if (_overlayHost?.parentNode) _overlayHost.parentNode.removeChild(_overlayHost);
    _overlayHost = null;
    _resolvedEffects = [];
    _rainSeeds.clear();
    _plumeSeeds.clear();
    _smogSeeds.clear();
    _active = false;
}

export function getStats() {
    return {
        active: _active,
        layers: _resolvedEffects.length,
        qualityTier: _quality?.currentTier?.() || "high",
        degradedReason: _lastDegradedReason,
    };
}

function _mountIfNeeded() {
    if (_active) return true;
    if (!_map || !window?.deck?.Deck) {
        _lastDegradedReason = "deckgl_runtime_missing";
        return false;
    }
    const container = _map.getContainer?.();
    if (!container) {
        _lastDegradedReason = "map_container_missing";
        return false;
    }
    _overlayHost = document.createElement("div");
    _overlayHost.className = "advanced-effects-host advanced-effects-host--deck";
    _overlayHost.style.position = "absolute";
    _overlayHost.style.inset = "0";
    _overlayHost.style.pointerEvents = "none";
    _overlayHost.style.zIndex = "470";
    container.appendChild(_overlayHost);

    try {
        _deck = new window.deck.Deck({
            parent: _overlayHost,
            controller: false,
            views: new window.deck.MapView({ repeat: false }),
            initialViewState: _leafletViewState(),
            layers: [],
            parameters: {
                depthTest: true,
                blend: true,
                blendFunc: [window.WebGLRenderingContext?.SRC_ALPHA || 770, window.WebGLRenderingContext?.ONE_MINUS_SRC_ALPHA || 771],
            },
        });
    } catch (err) {
        _lastDegradedReason = `deckgl_init_failed:${String(err?.message || err)}`;
        if (_overlayHost?.parentNode) _overlayHost.parentNode.removeChild(_overlayHost);
        _overlayHost = null;
        return false;
    }

    _map.on("move", _onMapMove);
    _map.on("zoom", _onMapMove);
    _map.on("resize", _onMapMove);
    _active = true;
    _lastDegradedReason = null;
    _rafId = requestAnimationFrame(_tick);
    return true;
}

function _tick(ts) {
    if (!_active || !_deck) {
        _rafId = null;
        return;
    }
    const t0 = performance.now();
    _timeMs = ts;
    _renderFrame();
    _quality.pushFrameMs(performance.now() - t0);
    _rafId = requestAnimationFrame(_tick);
}

function _renderFrame() {
    if (!_deck || !_map) return;
    const {
        LineLayer,
        ScatterplotLayer,
        TripsLayer,
        TextLayer,
    } = window.deck;
    const focused = _ctx?.state?.focusedEventId || null;
    const layers = [];

    const markerBase = _advancedMarkers();
    if (markerBase.points.length) {
        // Shadow pass: slight offset to fake depth while staying glued to map plane.
        const markerShadow = markerBase.points.map((p) => {
            const o = _offsetLngLat({ lng: p.lng, lat: p.lat }, 24, -24);
            return { ...p, lng: o.lng, lat: o.lat };
        });
        layers.push(new ScatterplotLayer({
            id: "adv-marker-shadow",
            data: markerShadow,
            pickable: false,
            opacity: 0.35,
            radiusUnits: "meters",
            getPosition: (d) => [d.lng, d.lat],
            getRadius: () => 145,
            getFillColor: () => [20, 24, 28, 120],
        }));
        layers.push(new ScatterplotLayer({
            id: "adv-marker-disc",
            data: markerBase.points,
            pickable: false,
            opacity: 0.92,
            stroked: true,
            lineWidthUnits: "pixels",
            lineWidthMinPixels: 1,
            radiusUnits: "meters",
            getPosition: (d) => [d.lng, d.lat],
            getRadius: () => 120,
            getFillColor: (d) => d.color,
            getLineColor: () => [245, 250, 255, 210],
        }));
        layers.push(new ScatterplotLayer({
            id: "adv-marker-glow",
            data: markerBase.points,
            pickable: false,
            opacity: 0.42,
            radiusUnits: "meters",
            getPosition: (d) => [d.lng, d.lat],
            getRadius: () => 230,
            getFillColor: (d) => [d.color[0], d.color[1], d.color[2], 80],
        }));
        layers.push(new TextLayer({
            id: "adv-marker-glyph",
            data: markerBase.points,
            billboard: true,
            pickable: false,
            sizeUnits: "pixels",
            getPosition: (d) => [d.lng, d.lat],
            getText: (d) => d.glyph,
            getColor: () => [240, 250, 255, 210],
            getSize: (d) => d.size,
        }));
    }

    for (const fx of _resolvedEffects) {
        const isDimmed = focused && fx.eventId !== focused;
        const focusScale = focused && fx.eventId === focused ? 1.25 : 1;
        const intensity = Math.max(0.05, Math.min(1, (fx.intensity || 0.5) * focusScale));
        const opacity = isDimmed ? 0.22 : 0.92;

        if (fx.type === "RAIN_3D") {
            const rainData = _rainLinesForEffect(fx, intensity);
            if (rainData.length) {
                layers.push(new LineLayer({
                    id: `fx-rain-${fx.id}`,
                    data: rainData,
                    opacity,
                    getSourcePosition: (d) => d.source,
                    getTargetPosition: (d) => d.target,
                    getColor: (d) => d.color,
                    getWidth: (d) => d.width,
                    widthUnits: "pixels",
                }));
            }
            continue;
        }

        if (fx.type === "GAS_PLUME_3D") {
            const plumeData = _plumePointsForEffect(fx, intensity);
            if (plumeData.length) {
                const plumeShadow = plumeData.map((p) => {
                    const o = _offsetLngLat({ lng: p.lng, lat: p.lat }, 36, -26);
                    return { ...p, lng: o.lng, lat: o.lat, color: [38, 32, 20, 82] };
                });
                layers.push(new ScatterplotLayer({
                    id: `fx-plume-shadow-${fx.id}`,
                    data: plumeShadow,
                    opacity: opacity * 0.65,
                    pickable: false,
                    radiusUnits: "meters",
                    getPosition: (d) => [d.lng, d.lat],
                    getRadius: (d) => d.radius * 0.92,
                    getFillColor: (d) => d.color,
                }));
                layers.push(new ScatterplotLayer({
                    id: `fx-plume-${fx.id}`,
                    data: plumeData,
                    opacity,
                    pickable: false,
                    radiusUnits: "meters",
                    getPosition: (d) => [d.lng, d.lat],
                    getRadius: (d) => d.radius,
                    getFillColor: (d) => d.color,
                }));
            }
            continue;
        }

        if (fx.type === "DISEASE_SMOG") {
            const smogData = _smogPointsForEffect(fx, intensity);
            if (smogData.length) {
                layers.push(new ScatterplotLayer({
                    id: `fx-disease-smog-${fx.id}`,
                    data: smogData,
                    opacity,
                    pickable: false,
                    radiusUnits: "meters",
                    getPosition: (d) => [d.lng, d.lat],
                    getRadius: (d) => d.radius,
                    getFillColor: (d) => d.color,
                }));
            }
            continue;
        }

        if (fx.type === "SKULL_SIGNS") {
            const skullData = _skullPointsForEffect(fx, intensity);
            if (skullData.length) {
                layers.push(new TextLayer({
                    id: `fx-skull-${fx.id}`,
                    data: skullData,
                    opacity,
                    pickable: false,
                    billboard: true,
                    sizeUnits: "pixels",
                    getPosition: (d) => [d.lng, d.lat],
                    getText: () => "\u2620",
                    getColor: () => [106, 255, 130, 230],
                    getSize: (d) => d.size,
                }));
            }
            continue;
        }

        if (fx.type === "ROAD_BUILD") {
            const trips = _tripDataForEffect(fx, intensity);
            if (trips.length) {
                layers.push(new TripsLayer({
                    id: `fx-road-${fx.id}`,
                    data: trips,
                    opacity,
                    currentTime: (_timeMs / 34) % 100,
                    trailLength: 30 + intensity * 36,
                    capRounded: true,
                    jointRounded: true,
                    widthMinPixels: 2,
                    getPath: (d) => d.path,
                    getTimestamps: (d) => d.timestamps,
                    getColor: (d) => d.color,
                    getWidth: (d) => d.width,
                }));
            }
        }
    }

    _deck.setProps({
        layers,
        viewState: _leafletViewState(),
    });
}

function _advancedMarkers() {
    const events = _ctx?.state?.events || [];
    const focused = _ctx?.state?.focusedEventId || null;
    const points = [];
    events.forEach((ev) => {
        if (!ev?.geoPoint) return;
        const base = CAT_COLORS[ev.category] || [85, 186, 171];
        const isDim = focused && focused !== ev.id;
        const color = isDim
            ? [Math.floor(base[0] * 0.45), Math.floor(base[1] * 0.45), Math.floor(base[2] * 0.45), 140]
            : [...base, 230];
        points.push({
            lng: ev.geoPoint.lng,
            lat: ev.geoPoint.lat,
            color,
            glyph: CAT_GLYPHS[ev.category] || "\u25CF",
            size: isDim ? 10 : 14,
        });
    });
    return { points };
}

function _rainLinesForEffect(effect, intensity) {
    const seeds = _getOrCreateRainSeeds(effect, intensity);
    const windLng = Math.sin(_timeMs / 1400) * 0.0012;
    const windLat = Math.cos(_timeMs / 1800) * 0.0006;
    return seeds.map((seed) => {
        const sway = Math.sin((_timeMs * 0.0025) + seed.phase) * 0.0006;
        return {
            source: [seed.lng + windLng + sway, seed.lat + 0.0032 + windLat],
            target: [seed.lng + sway * 0.4, seed.lat - 0.0012],
            color: [170, 210, 255, 225],
            width: 1 + intensity * 1.4,
        };
    });
}

function _plumePointsForEffect(effect, intensity) {
    const centers = _effectCenters(effect);
    if (!centers.length) return [];
    const seeds = _getOrCreatePlumeSeeds(effect, intensity);
    const data = [];
    const windDeg = Number(effect.params?.windDeg ?? effect.meta?.windDeg ?? 42);
    const windRad = (windDeg * Math.PI) / 180;
    const windSpeed = 10 + intensity * 14;
    const growth = 380 + intensity * 860;

    centers.forEach((center) => {
        seeds.forEach((s) => {
            const age = (_timeMs * s.speed + s.phase) % 1;
            const driftM = age * growth;
            const dx = Math.cos(windRad) * driftM + Math.sin(s.phase * 7) * s.spread * (1 - age * 0.35);
            const dy = Math.sin(windRad) * driftM + Math.cos(s.phase * 5) * s.spread * 0.6;
            const jitter = Math.sin((_timeMs / 1200) + s.phase * 11) * (40 + windSpeed * 2);
            const p = _offsetLngLat(center, dx + jitter, dy + jitter * 0.25);
            const heat = Math.max(0, 1 - age * 1.15);
            data.push({
                lng: p.lng,
                lat: p.lat,
                radius: 80 + s.radius * (0.75 + age * 1.4),
                color: _plumeColor(heat, s.alpha),
            });
        });
    });
    return data;
}

function _smogPointsForEffect(effect, intensity) {
    const centers = _effectCenters(effect);
    if (!centers.length) return [];
    const seeds = _getOrCreateSmogSeeds(effect, intensity);
    const out = [];
    centers.forEach((center) => {
        seeds.forEach((s) => {
            const t = (_timeMs * s.speed + s.phase) % 1;
            const driftM = (Math.sin((_timeMs / 1800) + s.phase * 4) * 160) + (t * 220);
            const p = _offsetLngLat(center, s.baseX + driftM, s.baseY + Math.cos(_timeMs / 1400 + s.phase * 3) * 90);
            const alpha = Math.floor(90 + Math.sin((_timeMs / 1000) + s.phase * 9) * 35 + s.alpha * 85);
            out.push({
                lng: p.lng,
                lat: p.lat,
                radius: 90 + s.radius * (0.65 + t),
                color: [64, 220, 118, Math.max(30, Math.min(220, alpha))],
            });
        });
    });
    return out;
}

function _skullPointsForEffect(effect, intensity) {
    const centers = _effectCenters(effect);
    const out = [];
    centers.forEach((c) => {
        const count = Math.max(3, Math.floor(5 + intensity * 7));
        for (let i = 0; i < count; i++) {
            const ang = ((i + 1) / (count + 1)) * Math.PI * 2;
            const drift = 0.0006 + intensity * 0.0016;
            out.push({
                lng: c.lng + Math.cos(ang) * drift,
                lat: c.lat + Math.sin(ang) * drift,
                size: 14 + Math.round(intensity * 12),
            });
        }
    });
    return out;
}

function _tripDataForEffect(effect, intensity) {
    const coords = effect.meta?.pathCoords || [];
    const path = coords.length
        ? coords.map((p) => [p.lng, p.lat])
        : (effect.geoPoint ? [[effect.geoPoint.lng, effect.geoPoint.lat]] : []);
    if (path.length < 2) return [];
    const timestamps = path.map((_, i) => (i / (path.length - 1)) * 100);
    return [{
        path,
        timestamps,
        color: [255, 190, 95, 240],
        width: 3 + intensity * 4,
    }];
}

function _effectCenters(effect) {
    if (effect.geoPoint) return [{ lng: effect.geoPoint.lng, lat: effect.geoPoint.lat }];
    if (effect.geometrySource === "pathCoords" && effect.meta?.pathCoords?.length) {
        return effect.meta.pathCoords.map((p) => ({ lng: p.lng, lat: p.lat }));
    }
    if (effect.geometrySource === "multiPoints" && effect.meta?.multiPoints?.length) {
        return effect.meta.multiPoints.map((p) => ({ lng: p.lng, lat: p.lat }));
    }
    return [];
}

function _getOrCreateRainSeeds(effect, intensity) {
    const key = effect.id;
    const existing = _rainSeeds.get(key);
    const target = Math.max(36, Math.floor(160 * intensity));
    if (existing && existing.length === target) return existing;
    const centers = _effectCenters(effect);
    if (!centers.length) return [];
    const seeds = [];
    for (let i = 0; i < target; i++) {
        const c = centers[i % centers.length];
        seeds.push({
            lng: c.lng + (Math.random() - 0.5) * 0.016,
            lat: c.lat + (Math.random() - 0.5) * 0.016,
            phase: Math.random() * Math.PI * 2,
        });
    }
    _rainSeeds.set(key, seeds);
    return seeds;
}

function _getOrCreatePlumeSeeds(effect, intensity) {
    const key = effect.id;
    const existing = _plumeSeeds.get(key);
    const target = Math.max(140, Math.floor(340 * intensity));
    if (existing && existing.length === target) return existing;
    const seeds = [];
    for (let i = 0; i < target; i++) {
        seeds.push({
            phase: Math.random(),
            speed: 0.00002 + Math.random() * 0.00004,
            spread: 80 + Math.random() * 300,
            radius: 80 + Math.random() * 220,
            alpha: 0.35 + Math.random() * 0.65,
        });
    }
    _plumeSeeds.set(key, seeds);
    return seeds;
}

function _getOrCreateSmogSeeds(effect, intensity) {
    const key = effect.id;
    const existing = _smogSeeds.get(key);
    const target = Math.max(90, Math.floor(220 * intensity));
    if (existing && existing.length === target) return existing;
    const seeds = [];
    for (let i = 0; i < target; i++) {
        seeds.push({
            phase: Math.random(),
            speed: 0.00003 + Math.random() * 0.00005,
            baseX: (Math.random() - 0.5) * 420,
            baseY: (Math.random() - 0.5) * 320,
            radius: 100 + Math.random() * 180,
            alpha: 0.35 + Math.random() * 0.65,
        });
    }
    _smogSeeds.set(key, seeds);
    return seeds;
}

function _plumeColor(heat, alphaSeed) {
    const h = Math.max(0, Math.min(1, heat));
    const a = Math.floor((60 + h * 155) * alphaSeed);
    const r = Math.floor(124 + h * 102);
    const g = Math.floor(104 + h * 68);
    const b = Math.floor(74 + h * 22);
    return [r, g, b, Math.max(28, Math.min(230, a))];
}

function _offsetLngLat(center, dxMeters, dyMeters) {
    const latScale = 111320;
    const lngScale = 111320 * Math.cos((center.lat * Math.PI) / 180);
    return {
        lng: center.lng + (dxMeters / Math.max(1, lngScale)),
        lat: center.lat + (dyMeters / latScale),
    };
}

function _leafletViewState() {
    const c = _map.getCenter();
    return {
        longitude: c.lng,
        latitude: c.lat,
        zoom: _map.getZoom(),
        bearing: 0,
        pitch: 0,
    };
}

function _onMapMove() {
    _renderFrame();
}
