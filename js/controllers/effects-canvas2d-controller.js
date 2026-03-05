import { resolveAdvancedEffectsForEvent } from "../services/effect-resolver.js";
import { createQualityManager } from "../services/quality-manager.js";
import { detectAdvancedEffectsSupport } from "../services/webgl-capability.js";

let _ctx;
let _map;
let _quality;
let _overlayHost;
let _canvas;
let _gfx;
let _active = false;
let _rafId = null;
let _resolvedLayers = [];
let _lastFrameTs = 0;
const _rainState = new Map(); // effectId -> particles
const _stormState = new Map(); // effectId -> phase
const _skullState = new Map(); // effectId -> jitter
const _regionGeometryCache = new Map(); // regionId -> latLng rings
const _FONT = "600 14px 'DM Mono', monospace";

export function init(ctx) {
    _ctx = ctx;
    _quality = createQualityManager();
}

export function setMap(mapInstance) {
    _map = mapInstance;
}

export function syncMode({ mode, isHistorical, connectionStatus, envEnabled }) {
    const shouldRun = mode === "live" && !isHistorical && connectionStatus === "live";
    if (!shouldRun) {
        _unmount();
        return;
    }
    const capability = detectAdvancedEffectsSupport();
    if (!capability?.canvas2d) {
        _unmount();
        return;
    }
    _mountIfNeeded();
    _render(_ctx.state.events || []);
}

export function renderForEvents(events) {
    if (!_active) return;
    _resolve(events || []);
}

export function suspendForHistorical() {
    _unmount();
}

export function getStats() {
    return {
        active: _active,
        layers: _resolvedLayers.length,
        qualityTier: _quality?.currentTier?.() || "high",
        degradedReason: null,
    };
}

function _mountIfNeeded() {
    if (_active || !_map) return;
    const container = _map.getContainer?.();
    if (!container) return;

    _overlayHost = document.createElement("div");
    _overlayHost.className = "advanced-effects-host";
    _overlayHost.style.position = "absolute";
    _overlayHost.style.inset = "0";
    _overlayHost.style.pointerEvents = "none";
    _overlayHost.style.zIndex = "470";
    _overlayHost.style.mixBlendMode = "screen";

    _canvas = document.createElement("canvas");
    _canvas.className = "advanced-effects-canvas";
    _canvas.style.width = "100%";
    _canvas.style.height = "100%";
    _canvas.style.pointerEvents = "none";
    _overlayHost.appendChild(_canvas);
    _gfx = _canvas.getContext("2d");

    container.appendChild(_overlayHost);
    _resizeCanvas();
    _map.on("resize", _resizeCanvas);
    _map.on("move", _onMapMove);
    _map.on("zoom", _onMapMove);
    _active = true;
}

function _unmount() {
    if (_rafId) cancelAnimationFrame(_rafId);
    if (_map) {
        _map.off("resize", _resizeCanvas);
        _map.off("move", _onMapMove);
        _map.off("zoom", _onMapMove);
    }
    _resolvedLayers = [];
    _rainState.clear();
    _stormState.clear();
    _skullState.clear();
    _rafId = null;
    if (_overlayHost?.parentNode) _overlayHost.parentNode.removeChild(_overlayHost);
    _overlayHost = null;
    _canvas = null;
    _gfx = null;
    _active = false;
}

function _resolve(events) {
    if (!_overlayHost || !_map) return;
    const layers = [];

    events.forEach((event) => {
        const resolved = resolveAdvancedEffectsForEvent(event);
        resolved.effects.forEach((fx) => {
            if (!fx.enabled) return;
            layers.push(_quality.applyIntensityScale({
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

    _resolvedLayers = layers.sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0));
    _overlayHost.dataset.layers = String(_resolvedLayers.length);
    _overlayHost.dataset.preview = _resolvedLayers.slice(0, 4).map((l) => `${l.type}:${l.eventId}`).join("|");
    if (!_rafId) _rafId = requestAnimationFrame(_tick);
}

function _tick(ts) {
    if (!_active || !_gfx || !_canvas) {
        _rafId = null;
        return;
    }
    const t0 = performance.now();
    const delta = Math.max(0.016, Math.min(0.05, (ts - (_lastFrameTs || ts)) / 1000));
    _lastFrameTs = ts;

    _resizeCanvas();
    _gfx.clearRect(0, 0, _canvas.width, _canvas.height);

    const focusedId = _ctx?.state?.focusedEventId || null;
    for (const layer of _resolvedLayers) {
        const dim = focusedId && layer.eventId !== focusedId;
        _drawLayer(layer, ts, delta, dim ? 0.35 : 1);
    }

    const frameMs = performance.now() - t0;
    _quality.pushFrameMs(frameMs);

    _rafId = requestAnimationFrame(_tick);
}

function _drawLayer(layer, ts, delta, alpha = 1) {
    switch (layer.type) {
        case "RAIN_3D":
            _drawRain(layer, ts, delta, alpha);
            break;
        case "THUNDERSTORM":
            _drawThunder(layer, ts, alpha);
            break;
        case "GAS_PLUME_3D":
            _drawPlume(layer, ts, alpha);
            break;
        case "DISEASE_SMOG":
            _drawSmog(layer, ts, alpha);
            break;
        case "SKULL_SIGNS":
            _drawSkulls(layer, ts, alpha);
            break;
        case "ROAD_BUILD":
            _drawRoadBuild(layer, ts, alpha);
            break;
        case "TEMP_RISE":
            _drawTempRise(layer, ts, alpha);
            break;
        case "TEMP_DROP":
            _drawTempDrop(layer, ts, alpha);
            break;
        default:
            break;
    }
}

function _drawRain(layer, ts, delta, alpha) {
    const bounds = _layerBoundsPx(layer);
    if (!bounds) return;
    const key = layer.id;
    const particles = _rainState.get(key) || [];
    const target = Math.max(60, Math.floor(260 * (layer.intensity || 0.5)));

    while (particles.length < target) {
        particles.push({
            x: bounds.x + Math.random() * bounds.w,
            y: bounds.y + Math.random() * bounds.h,
            speed: 250 + Math.random() * 450,
            len: 8 + Math.random() * 10,
        });
    }
    if (particles.length > target) particles.length = target;

    _gfx.save();
    _gfx.globalAlpha = 0.65 * alpha;
    _gfx.strokeStyle = "rgba(170,210,255,0.95)";
    _gfx.lineWidth = 1.2;
    _gfx.beginPath();
    for (const p of particles) {
        p.y += p.speed * delta;
        p.x += 20 * delta;
        if (p.y > bounds.y + bounds.h + 8) {
            p.y = bounds.y - 8;
            p.x = bounds.x + Math.random() * bounds.w;
        }
        _gfx.moveTo(p.x, p.y);
        _gfx.lineTo(p.x - 2, p.y + p.len);
    }
    _gfx.stroke();
    _gfx.restore();
    _rainState.set(key, particles);
}

function _drawThunder(layer, ts, alpha) {
    const phase = _stormState.get(layer.id) || { next: 0, flash: 0 };
    if (ts > phase.next) {
        phase.flash = 0.45 + Math.random() * 0.35 * (layer.intensity || 0.7);
        phase.next = ts + 1700 + Math.random() * 2200;
    } else {
        phase.flash *= 0.9;
    }
    _stormState.set(layer.id, phase);
    if (phase.flash < 0.04) return;

    _gfx.save();
    _gfx.globalAlpha = phase.flash * alpha;
    _gfx.fillStyle = "rgba(210,225,255,0.9)";
    _gfx.fillRect(0, 0, _canvas.width, _canvas.height);
    _gfx.restore();
}

function _drawPlume(layer, ts, alpha) {
    const centers = _layerCentersPx(layer);
    if (!centers.length) return;
    const spread = 80 + (layer.intensity || 0.5) * 140;
    _gfx.save();
    _gfx.globalAlpha = 0.35 * alpha;
    for (const c of centers) {
        const windX = Math.sin(ts / 1400) * 22;
        const windY = Math.cos(ts / 1800) * 12;
        const g = _gfx.createRadialGradient(c.x + windX, c.y + windY, 2, c.x + windX, c.y + windY, spread);
        g.addColorStop(0, "rgba(190,180,120,0.65)");
        g.addColorStop(0.35, "rgba(150,140,90,0.35)");
        g.addColorStop(1, "rgba(120,110,80,0.0)");
        _gfx.fillStyle = g;
        _gfx.beginPath();
        _gfx.ellipse(c.x + windX, c.y + windY, spread * 1.25, spread * 0.8, 0.3, 0, Math.PI * 2);
        _gfx.fill();
    }
    _gfx.restore();
}

function _drawSmog(layer, ts, alpha) {
    const centers = _layerCentersPx(layer);
    if (!centers.length) return;
    const radius = 70 + (layer.intensity || 0.5) * 160;
    _gfx.save();
    _gfx.globalAlpha = 0.28 * alpha;
    for (const c of centers) {
        const pulse = 0.9 + Math.sin(ts / 900 + c.x * 0.01) * 0.12;
        const r = radius * pulse;
        const g = _gfx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, "rgba(90,255,120,0.52)");
        g.addColorStop(0.5, "rgba(50,170,80,0.28)");
        g.addColorStop(1, "rgba(50,120,70,0.0)");
        _gfx.fillStyle = g;
        _gfx.beginPath();
        _gfx.arc(c.x, c.y, r, 0, Math.PI * 2);
        _gfx.fill();
    }
    _gfx.restore();
}

function _drawSkulls(layer, ts, alpha) {
    const pts = _layerCentersPx(layer);
    if (!pts.length) return;
    const key = layer.id;
    if (!_skullState.has(key)) {
        _skullState.set(key, pts.map(() => (Math.random() * 1000)));
    }
    const jitters = _skullState.get(key);

    _gfx.save();
    _gfx.globalAlpha = 0.9 * alpha;
    _gfx.font = _FONT;
    _gfx.textAlign = "center";
    _gfx.textBaseline = "middle";
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const wobble = Math.sin((ts + jitters[i]) / 500) * 2;
        _gfx.fillStyle = "rgba(110,255,120,0.9)";
        _gfx.fillText("\u2620", p.x, p.y - 10 + wobble);
    }
    _gfx.restore();
}

function _drawRoadBuild(layer, ts, alpha) {
    const path = _pathPointsPx(layer);
    if (path.length < 2) return;
    const phase = (ts / 28) % 1000;

    _gfx.save();
    _gfx.globalAlpha = 0.9 * alpha;
    _gfx.strokeStyle = "rgba(255,180,70,0.85)";
    _gfx.lineWidth = 3 + (layer.intensity || 0.5) * 4;
    _gfx.setLineDash([12, 10]);
    _gfx.lineDashOffset = -phase;
    _gfx.beginPath();
    _gfx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) _gfx.lineTo(path[i].x, path[i].y);
    _gfx.stroke();
    _gfx.setLineDash([]);

    const marker = _pointAlongPath(path, (phase % 260) / 260);
    if (marker) {
        _gfx.fillStyle = "rgba(255,230,140,0.95)";
        _gfx.beginPath();
        _gfx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
        _gfx.fill();
    }
    _gfx.restore();
}

function _drawTempRise(layer, ts, alpha) {
    const centers = _layerCentersPx(layer);
    if (!centers.length) return;
    _gfx.save();
    _gfx.globalAlpha = 0.25 * alpha;
    for (const c of centers) {
        const r = 90 + (layer.intensity || 0.5) * 120;
        const g = _gfx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, "rgba(255,150,40,0.42)");
        g.addColorStop(0.65, "rgba(255,70,20,0.2)");
        g.addColorStop(1, "rgba(255,40,10,0)");
        _gfx.fillStyle = g;
        _gfx.beginPath();
        _gfx.arc(c.x, c.y, r, 0, Math.PI * 2);
        _gfx.fill();

        _gfx.strokeStyle = "rgba(255,220,160,0.28)";
        _gfx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const yOff = Math.sin((ts / 250) + i * 1.2) * 4 + i * 8;
            _gfx.beginPath();
            _gfx.arc(c.x, c.y + yOff, r * (0.35 + i * 0.12), Math.PI * 0.15, Math.PI * 0.85);
            _gfx.stroke();
        }
    }
    _gfx.restore();
}

function _drawTempDrop(layer, ts, alpha) {
    const centers = _layerCentersPx(layer);
    if (!centers.length) return;
    _gfx.save();
    _gfx.globalAlpha = 0.24 * alpha;
    for (const c of centers) {
        const r = 80 + (layer.intensity || 0.5) * 130;
        const g = _gfx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, "rgba(110,190,255,0.42)");
        g.addColorStop(0.6, "rgba(80,140,240,0.2)");
        g.addColorStop(1, "rgba(40,90,220,0)");
        _gfx.fillStyle = g;
        _gfx.beginPath();
        _gfx.arc(c.x, c.y, r, 0, Math.PI * 2);
        _gfx.fill();

        const flakeCount = Math.max(4, Math.floor(12 * (layer.intensity || 0.5)));
        _gfx.fillStyle = "rgba(210,235,255,0.8)";
        for (let i = 0; i < flakeCount; i++) {
            const a = ((ts / 1300) + i / flakeCount) * Math.PI * 2;
            const rr = (r * 0.25) + ((i * 29) % Math.max(18, r * 0.8));
            const x = c.x + Math.cos(a) * rr;
            const y = c.y + Math.sin(a * 1.3) * rr;
            _gfx.fillRect(x, y, 2, 2);
        }
    }
    _gfx.restore();
}

function _layerCentersPx(layer) {
    if (!_map) return [];
    const src = layer.geometrySource;
    if (src === "geoPoint" && layer.geoPoint) {
        return [_project(layer.geoPoint)];
    }
    if (src === "pathCoords") {
        return _pathPointsPx(layer);
    }
    if (src === "heatPoints") {
        return (layer.meta?.heatPoints || []).map((p) => _project(p));
    }
    if (src === "multiPoints") {
        const pts = layer.meta?.multiPoints || layer.meta?.clusterPoints || [];
        return pts.map((p) => _project(p));
    }
    if (src === "regionPolygon") {
        const regionPts = _regionPointsPx(layer);
        if (regionPts.length) return regionPts;
    }
    if (layer.geoPoint) return [_project(layer.geoPoint)];
    return [];
}

function _pathPointsPx(layer) {
    const coords = layer.meta?.pathCoords || [];
    return coords.map((c) => _project(c));
}

function _regionPointsPx(layer) {
    const ids = [];
    if (layer.regionId) ids.push(layer.regionId);
    if (Array.isArray(layer.regionIds)) ids.push(...layer.regionIds);
    const uniq = [...new Set(ids.filter(Boolean))];
    const points = [];
    for (const id of uniq) {
        const rings = _regionLatLngRings(id);
        for (const ring of rings) {
            for (let i = 0; i < ring.length; i += Math.max(1, Math.floor(ring.length / 18))) {
                points.push(_project({ lat: ring[i].lat, lng: ring[i].lng }));
            }
        }
    }
    return points;
}

function _regionLatLngRings(regionId) {
    if (_regionGeometryCache.has(regionId)) return _regionGeometryCache.get(regionId);
    const rings = [];
    if (!_map) return rings;
    _map.eachLayer((layer) => {
        if (!layer?.feature?.properties) return;
        const id = layer.feature.properties.id ?? layer.feature.id;
        if (id !== regionId) return;
        const latLngs = layer.getLatLngs?.();
        if (!latLngs) return;
        _flattenRings(latLngs, rings);
    });
    _regionGeometryCache.set(regionId, rings);
    return rings;
}

function _flattenRings(input, out) {
    if (!Array.isArray(input)) return;
    if (input.length && input[0]?.lat !== undefined && input[0]?.lng !== undefined) {
        out.push(input);
        return;
    }
    input.forEach((child) => _flattenRings(child, out));
}

function _layerBoundsPx(layer) {
    const pts = _layerCentersPx(layer);
    if (!pts.length) return null;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    pts.forEach((p) => {
        if (!p) return;
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    if (!isFinite(minX)) return null;
    const pad = 80 + (layer.intensity || 0.5) * 120;
    return {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: Math.min(_canvas.width, maxX + pad) - Math.max(0, minX - pad),
        h: Math.min(_canvas.height, maxY + pad) - Math.max(0, minY - pad),
    };
}

function _project(latLng) {
    const p = _map.latLngToContainerPoint([latLng.lat, latLng.lng]);
    return { x: p.x, y: p.y };
}

function _pointAlongPath(path, t) {
    if (path.length < 2) return null;
    const lengths = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x;
        const dy = path[i].y - path[i - 1].y;
        const len = Math.hypot(dx, dy);
        lengths.push(len);
        total += len;
    }
    if (!total) return path[0];
    let target = total * Math.max(0, Math.min(1, t));
    for (let i = 1; i < path.length; i++) {
        if (target <= lengths[i - 1]) {
            const r = lengths[i - 1] ? target / lengths[i - 1] : 0;
            return {
                x: path[i - 1].x + (path[i].x - path[i - 1].x) * r,
                y: path[i - 1].y + (path[i].y - path[i - 1].y) * r,
            };
        }
        target -= lengths[i - 1];
    }
    return path[path.length - 1];
}

function _resizeCanvas() {
    if (!_canvas || !_overlayHost) return;
    const rect = _overlayHost.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (_canvas.width !== w || _canvas.height !== h) {
        _canvas.width = w;
        _canvas.height = h;
    }
    if (_gfx) {
        _gfx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}

function _onMapMove() {
    _regionGeometryCache.clear();
}
