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
                depthTest: false,
                blend: true,
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
    const { LineLayer, ScatterplotLayer, TripsLayer, TextLayer } = window.deck;
    const focused = _ctx?.state?.focusedEventId || null;
    const layers = [];

    for (const fx of _resolvedEffects) {
        const isDimmed = focused && fx.eventId !== focused;
        const focusScale = focused && fx.eventId === focused ? 1.25 : 1;
        const intensity = Math.max(0.05, Math.min(1, (fx.intensity || 0.5) * focusScale));
        const opacity = isDimmed ? 0.24 : 0.88;
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
                layers.push(new ScatterplotLayer({
                    id: `fx-plume-${fx.id}`,
                    data: plumeData,
                    opacity,
                    pickable: false,
                    getPosition: (d) => [d.lng, d.lat],
                    getFillColor: (d) => [167, 145, 86, Math.floor(140 + d.weight * 65)],
                    getRadius: (d) => d.radius,
                    radiusUnits: "meters",
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
                    getPosition: (d) => [d.lng, d.lat],
                    getFillColor: (d) => [64, 220, 118, Math.floor(120 + d.weight * 90)],
                    getRadius: (d) => d.radius,
                    radiusUnits: "meters",
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
                    currentTime: (_timeMs / 38) % 100,
                    trailLength: 28 + intensity * 30,
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

function _rainLinesForEffect(effect, intensity) {
    const seeds = _getOrCreateRainSeeds(effect, intensity);
    const windLng = Math.sin(_timeMs / 1400) * 0.0012;
    const windLat = Math.cos(_timeMs / 1800) * 0.0006;
    return seeds.map((seed) => {
        const sway = Math.sin((_timeMs * 0.0025) + seed.phase) * 0.0006;
        return {
            source: [seed.lng + windLng + sway, seed.lat + 0.0032 + windLat, 40],
            target: [seed.lng + sway * 0.4, seed.lat - 0.0012, 2],
            color: [170, 210, 255, 225],
            width: 1 + intensity * 1.3,
        };
    });
}

function _plumePointsForEffect(effect, intensity) {
    const centers = _effectCenters(effect);
    const out = [];
    centers.forEach((c) => {
        for (let i = 0; i < 54; i++) {
            const ang = (i / 54) * Math.PI * 2;
            const drift = 0.0018 + intensity * 0.0032;
            const wobble = Math.sin((_timeMs / 1200) + i) * 0.0009;
            const lng = c.lng + (Math.cos(ang) * drift * 1.3) + wobble;
            const lat = c.lat + (Math.sin(ang) * drift * 0.8) + (Math.cos(_timeMs / 1600) * 0.0006);
            out.push({
                lng,
                lat,
                weight: 0.55 + Math.random() * 0.45,
                radius: 150 + Math.random() * 240,
            });
        }
    });
    return out;
}

function _smogPointsForEffect(effect, intensity) {
    const centers = _effectCenters(effect);
    const out = [];
    centers.forEach((c) => {
        for (let i = 0; i < 70; i++) {
            const ang = (i / 70) * Math.PI * 2;
            const drift = 0.0014 + intensity * 0.0028;
            const wobble = Math.cos((_timeMs / 1000) + i * 0.6) * 0.0007;
            const lng = c.lng + (Math.cos(ang) * drift) + wobble;
            const lat = c.lat + (Math.sin(ang) * drift) + (Math.sin(_timeMs / 1300) * 0.0004);
            out.push({
                lng,
                lat,
                weight: 0.45 + Math.random() * 0.55,
                radius: 120 + Math.random() * 220,
            });
        }
    });
    return out;
}

function _skullPointsForEffect(effect, intensity) {
    const centers = _effectCenters(effect);
    const out = [];
    centers.forEach((c) => {
        const count = Math.max(2, Math.floor(4 + intensity * 6));
        for (let i = 0; i < count; i++) {
            const ang = ((i + 1) / (count + 1)) * Math.PI * 2;
            const drift = 0.0007 + intensity * 0.0012;
            out.push({
                lng: c.lng + Math.cos(ang) * drift,
                lat: c.lat + Math.sin(ang) * drift,
                size: 14 + Math.round(intensity * 10),
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
    const target = Math.max(28, Math.floor(120 * intensity));
    if (existing && existing.length === target) return existing;
    const centers = _effectCenters(effect);
    if (!centers.length) return [];
    const seeds = [];
    for (let i = 0; i < target; i++) {
        const c = centers[i % centers.length];
        seeds.push({
            lng: c.lng + (Math.random() - 0.5) * 0.014,
            lat: c.lat + (Math.random() - 0.5) * 0.014,
            phase: Math.random() * Math.PI * 2,
        });
    }
    _rainSeeds.set(key, seeds);
    return seeds;
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
