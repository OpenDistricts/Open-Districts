import { createDiffusionLayer } from "./effects/diffusion-effect.js";
import { resolveAdvancedEffectsForEvent } from "../services/effect-resolver.js";

const CAT_COLORS = {
    emergency: 0xe74f62,
    health: 0x43d98b,
    safety: 0x55b8d9,
    infrastructure: 0xe0a857,
    mobility: 0x6f86ff,
    weather: 0x7b9cff,
};

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function categoryColor(category) {
    return CAT_COLORS[category] || 0x67bfb4;
}

function alphaFromIntensity(i, base = 0.25, span = 0.5) {
    return clamp(base + (clamp(i, 0, 1) * span), 0.04, 0.95);
}

function gaussianAlpha(distanceNorm, sigma = 0.42) {
    const d = clamp(distanceNorm, 0, 1.5);
    const s = Math.max(0.08, sigma);
    return Math.exp(-((d * d) / (2 * s * s)));
}

function metresToPixels(map, latLng, metres) {
    const c = map.latLngToContainerPoint([latLng.lat, latLng.lng]);
    const n = map.latLngToContainerPoint([latLng.lat + (metres / 111320), latLng.lng]);
    return Math.max(1, Math.hypot(n.x - c.x, n.y - c.y));
}

function pointDistanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = (dx * dx) + (dy * dy);
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = clamp(t, 0, 1);
    const x = ax + (dx * t);
    const y = ay + (dy * t);
    return Math.hypot(px - x, py - y);
}

function normalizeFromAdvancedEffect(event, fx) {
    const meta = event.meta || {};
    const params = fx.params || {};
    return {
        eventId: event.id,
        title: event.title || event.id,
        summary: event.summary || "",
        category: event.category || "unknown",
        effectType: fx.type,
        renderAs: event.renderAs || "",
        intensity: clamp(Number(fx.intensity ?? 0.5), 0.05, 1),
        geoPoint: event.geoPoint || null,
        regionId: event.regionId || null,
        regionIds: Array.isArray(event.regionIds) ? event.regionIds : [],
        geometrySource: fx.geometrySource || "geoPoint",
        heatPoints: meta.heatPoints || [],
        multiPoints: meta.multiPoints || [],
        pathCoords: meta.pathCoords || [],
        radiusMetres: Number(meta.radiusMetres ?? params.radiusMetres ?? 900),
        windBearing: Number(meta.windBearing ?? params.windBearing ?? 35),
        windSpeedKmh: Number(meta.windSpeedKmh ?? params.windSpeedKmh ?? 8),
        diffusionProfile: meta.diffusionProfile ?? params.diffusionProfile ?? "gaussian",
        expectedRainfallMm: Number(meta.expectedRainfallMm ?? params.expectedRainfallMm ?? 0),
        fireScale: Number(meta.fireScale ?? params.fireScale ?? 1),
    };
}

function normalizeFromRenderAsFallback(event) {
    const common = {
        eventId: event.id,
        title: event.title || event.id,
        summary: event.summary || "",
        category: event.category || "unknown",
        renderAs: event.renderAs || "",
        intensity: clamp(Number(event.meta?.intensity ?? 0.6), 0.05, 1),
        geoPoint: event.geoPoint || null,
        regionId: event.regionId || null,
        regionIds: Array.isArray(event.regionIds) ? event.regionIds : [],
        heatPoints: event.meta?.heatPoints || [],
        multiPoints: event.meta?.multiPoints || [],
        pathCoords: event.meta?.pathCoords || [],
        radiusMetres: Number(event.meta?.radiusMetres ?? 850),
        expectedRainfallMm: Number(event.meta?.expectedRainfallMm ?? 0),
        windBearing: Number(event.meta?.windBearing ?? 35),
        windSpeedKmh: Number(event.meta?.windSpeedKmh ?? 8),
        fireScale: Number(event.meta?.fireScale ?? 1),
    };
    const out = [];
    switch (event.renderAs) {
        case "diffusion":
            out.push({ ...common, effectType: "GAS_PLUME_3D", geometrySource: "geoPoint" });
            break;
        case "hotspot":
            out.push({ ...common, effectType: "HOTSPOT_GPU", geometrySource: "heatPoints" });
            break;
        case "corridor":
            out.push({ ...common, effectType: "CORRIDOR_FLOW", geometrySource: "pathCoords" });
            break;
        case "radial":
            out.push({ ...common, effectType: "RADIAL_ZONE", geometrySource: "geoPoint" });
            break;
        case "polygon_fill":
            out.push({ ...common, effectType: "HAZARD_ZONE", geometrySource: "regionPolygon" });
            break;
        case "multi_marker":
            out.push({ ...common, effectType: "EVENT_MARKER_3D", geometrySource: "multiPoints" });
            break;
        case "marker":
            out.push({ ...common, effectType: "EVENT_MARKER_3D", geometrySource: "geoPoint" });
            break;
        default:
            break;
    }
    if (event.category === "emergency" && String(event.meta?.type || "").toLowerCase() === "fire") {
        out.push({ ...common, effectType: "FIRE_INCIDENT", geometrySource: "geoPoint" });
    }
    if (event.category === "weather" && common.expectedRainfallMm > 0) {
        out.push({ ...common, effectType: "RAIN_3D", geometrySource: "geoPoint" });
    }
    return out;
}

function loadShaderSource() {
    const fallback = `#shader-set: diffusion-particles
// Placeholder bundle for forward shader migration.
`;
    return fetch(new URL("../../shaders/particle-shaders.glsl", import.meta.url))
        .then((r) => (r.ok ? r.text() : fallback))
        .catch(() => fallback);
}

function buildRainStreakTexture(app) {
    const g = new window.PIXI.Graphics();
    g.lineStyle(2, 0xd2e5ff, 1);
    g.moveTo(1, 0);
    g.lineTo(10, 20);
    const tex = app.renderer.generateTexture(g, {
        resolution: 1,
        scaleMode: window.PIXI.SCALE_MODES.LINEAR,
    });
    g.destroy();
    return tex;
}

function createRainStreakLayer({ app }) {
    const container = new window.PIXI.Container();
    container.name = "rain-streaks";
    container.blendMode = window.PIXI.BLEND_MODES.SCREEN;
    const texture = buildRainStreakTexture(app);
    const streaks = [];

    function _spawn(streak, width, height, fromTop = false) {
        streak.x = Math.random() * width;
        streak.y = fromTop ? (-18 - Math.random() * 32) : (Math.random() * height);
    }

    function _ensureCount(target, width, height) {
        while (streaks.length < target) {
            const sprite = new window.PIXI.Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.blendMode = window.PIXI.BLEND_MODES.SCREEN;
            sprite.alpha = 0.14;
            const streak = {
                sprite,
                alphaJitter: Math.random(),
                scaleJitter: 0.82 + (Math.random() * 0.45),
            };
            _spawn(streak, width, height, false);
            sprite.scale.set(streak.scaleJitter, streak.scaleJitter);
            container.addChild(sprite);
            streaks.push(streak);
        }
        while (streaks.length > target) {
            const removed = streaks.pop();
            if (!removed) break;
            container.removeChild(removed.sprite);
            removed.sprite.destroy();
        }
    }

    function update(rainEffects, dtSec) {
        const width = Math.max(1, app.renderer.width);
        const height = Math.max(1, app.renderer.height);

        if (!rainEffects.length) {
            _ensureCount(0, width, height);
            container.visible = false;
            return;
        }

        container.visible = true;
        let maxIntensity = 0.45;
        let maxRain = 0;
        rainEffects.forEach((e) => {
            maxIntensity = Math.max(maxIntensity, clamp(Number(e.intensity ?? 0.5), 0.1, 1));
            maxRain = Math.max(maxRain, Number(e.expectedRainfallMm ?? 0));
        });

        const targetCount = clamp(
            Math.round(40 + (maxIntensity * 85) + Math.min(26, maxRain * 1.2)),
            40,
            170
        );
        _ensureCount(targetCount, width, height);

        const downSpeed = 280 + (maxIntensity * 160); // px/s, constant downward velocity
        const driftX = 54;

        for (let i = 0; i < streaks.length; i += 1) {
            const s = streaks[i];
            s.y += downSpeed * dtSec;
            s.x += driftX * dtSec;
            if (s.y > height + 24 || s.x > width + 24) {
                _spawn(s, width, height, true);
            }

            s.sprite.x = s.x;
            s.sprite.y = s.y;
            s.sprite.alpha = clamp(0.1 + (s.alphaJitter * 0.1), 0.1, 0.2);
        }
    }

    function destroy() {
        _ensureCount(0, 1, 1);
        container.destroy({ children: true });
        texture.destroy(true);
    }

    return {
        container,
        update,
        destroy,
    };
}

export function createEffectsEngine({ map, app }) {
    const stage = app.stage;
    stage.sortableChildren = true;

    const layers = {
        basemap: new window.PIXI.Container(),
        admin: new window.PIXI.Container(),
        corridor: new window.PIXI.Container(),
        diffusion: new window.PIXI.Container(),
        particles: new window.PIXI.Container(),
        markers: new window.PIXI.Container(),
        alerts: new window.PIXI.Container(),
    };
    const zOrder = { basemap: 1, admin: 2, corridor: 3, diffusion: 4, particles: 5, markers: 6, alerts: 7 };
    Object.entries(layers).forEach(([k, c]) => {
        c.name = `fx-${k}`;
        c.zIndex = zOrder[k];
        stage.addChild(c);
    });

    const toggles = {
        basemap: true, admin: true, corridor: true, diffusion: true, particles: true, markers: true, alerts: true,
    };

    layers.diffusion.blendMode = window.PIXI.BLEND_MODES.SCREEN;

    const gHazard = new window.PIXI.Graphics();
    const gHazardGlow = new window.PIXI.Graphics();
    const gHotspot = new window.PIXI.Graphics();
    const gCorridor = new window.PIXI.Graphics();
    const gRadial = new window.PIXI.Graphics();
    const gSmog = new window.PIXI.Graphics();
    const gTemp = new window.PIXI.Graphics();
    const gStorm = new window.PIXI.Graphics();
    const gMarkers = new window.PIXI.Graphics();
    const gSkulls = new window.PIXI.Graphics();
    const gAlerts = new window.PIXI.Graphics();
    const gFire = new window.PIXI.Graphics();

    gHotspot.blendMode = window.PIXI.BLEND_MODES.SCREEN;
    gSmog.blendMode = window.PIXI.BLEND_MODES.SCREEN;

    if (window.PIXI.filters?.BlurFilter) {
        const blur = new window.PIXI.filters.BlurFilter(8);
        blur.quality = 2;
        gHazardGlow.filters = [blur];
    }
    gHazardGlow.blendMode = window.PIXI.BLEND_MODES.SCREEN;

    layers.admin.addChild(gHazardGlow, gHazard);
    layers.diffusion.addChild(gSmog, gHotspot, gTemp, gStorm);
    layers.corridor.addChild(gCorridor, gRadial);
    layers.markers.addChild(gMarkers, gSkulls);
    layers.alerts.addChild(gAlerts);

    const rainLayer = createRainStreakLayer({ app });
    layers.particles.addChild(rainLayer.container, gFire);

    const diffusion = createDiffusionLayer({ app, map, layerName: "diffusion-plume" });
    layers.particles.addChild(diffusion.container);

    let shaderSource = "";
    loadShaderSource().then((src) => { shaderSource = src; });

    let activeEffects = [];
    let interactionItems = [];

    function setLayerVisible(layerName, visible) {
        if (!(layerName in toggles)) return;
        toggles[layerName] = !!visible;
        layers[layerName].visible = toggles[layerName];
    }

    function setEvents(events) {
        activeEffects = [];
        const diffusionList = [];
        (events || []).forEach((event) => {
            const resolved = resolveAdvancedEffectsForEvent(event);
            const advanced = resolved.effects
                .filter((fx) => fx.enabled !== false)
                .map((fx) => normalizeFromAdvancedEffect(event, fx));
            const fallbacks = normalizeFromRenderAsFallback(event);
            const combined = [...advanced];
            fallbacks.forEach((f) => {
                const exists = combined.some((a) => a.effectType === f.effectType);
                if (!exists) combined.push(f);
            });
            combined.forEach((e) => {
                activeEffects.push(e);
                if (e.effectType === "GAS_PLUME_3D" && e.geoPoint) diffusionList.push(e);
            });
        });
        const ids = new Set(diffusionList.map((d) => d.eventId));
        diffusionList.forEach((d) => diffusion.upsertEvent({
            id: d.eventId,
            geoPoint: d.geoPoint,
            intensity: d.intensity,
            radiusMetres: d.radiusMetres,
            windBearing: d.windBearing,
            windSpeedKmh: d.windSpeedKmh,
            diffusionProfile: d.diffusionProfile,
        }));
        diffusion.removeMissing(ids);
        _rebuildInteractionCache();
    }

    function _rebuildInteractionCache() {
        interactionItems = [];
        activeEffects.forEach((fx) => {
            if (fx.geometrySource === "geoPoint" && fx.geoPoint) {
                interactionItems.push({
                    eventId: fx.eventId,
                    title: fx.title,
                    summary: fx.summary,
                    category: fx.category,
                    effectType: fx.effectType,
                    center: fx.geoPoint,
                    radiusMetres: fx.radiusMetres || 850,
                });
            }
            if (fx.geometrySource === "multiPoints" && fx.multiPoints.length) {
                fx.multiPoints.forEach((p) => {
                    interactionItems.push({
                        eventId: fx.eventId, title: fx.title, summary: fx.summary, category: fx.category, effectType: fx.effectType,
                        center: p, radiusMetres: 380,
                    });
                });
            }
            if (fx.geometrySource === "heatPoints" && fx.heatPoints.length) {
                fx.heatPoints.forEach((p) => {
                    interactionItems.push({
                        eventId: fx.eventId, title: fx.title, summary: fx.summary, category: fx.category, effectType: fx.effectType,
                        center: p, radiusMetres: fx.radiusMetres || 550,
                    });
                });
            }
        });
    }

    function _regionRings(regionId) {
        const rings = [];
        if (!regionId) return rings;
        map.eachLayer((layer) => {
            const props = layer?.feature?.properties;
            if (!props) return;
            const id = props.id ?? layer.feature.id;
            if (id !== regionId) return;
            const latLngs = layer.getLatLngs?.();
            if (!latLngs) return;
            _flattenRings(latLngs, rings);
        });
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

    function _drawHazardZones() {
        gHazard.clear();
        gHazardGlow.clear();
        activeEffects.filter((e) => e.effectType === "HAZARD_ZONE").forEach((e) => {
            const ids = [...new Set([e.regionId, ...(e.regionIds || [])].filter(Boolean))];
            const color = categoryColor(e.category);
            ids.forEach((id) => {
                _regionRings(id).forEach((ring) => {
                    if (!ring.length) return;
                    const first = map.latLngToContainerPoint([ring[0].lat, ring[0].lng]);

                    // UX tuning: soft region tint + edge glow to keep city labels readable.
                    gHazard.beginFill(color, 0.12);
                    gHazard.lineStyle(1.5, color, 0.25);
                    gHazard.moveTo(first.x, first.y);
                    for (let i = 1; i < ring.length; i += 1) {
                        const p = map.latLngToContainerPoint([ring[i].lat, ring[i].lng]);
                        gHazard.lineTo(p.x, p.y);
                    }
                    gHazard.closePath();
                    gHazard.endFill();

                    gHazardGlow.lineStyle(6, color, 0.25);
                    gHazardGlow.moveTo(first.x, first.y);
                    for (let i = 1; i < ring.length; i += 1) {
                        const p = map.latLngToContainerPoint([ring[i].lat, ring[i].lng]);
                        gHazardGlow.lineTo(p.x, p.y);
                    }
                    gHazardGlow.closePath();
                });
            });
        });
    }

    function _drawHotspots(timeSec) {
        gHotspot.clear();
        activeEffects.filter((e) => e.effectType === "HOTSPOT_GPU").forEach((e) => {
            const pts = e.heatPoints.length ? e.heatPoints : (e.geoPoint ? [e.geoPoint] : []);
            const color = categoryColor(e.category);
            const baseAlpha = alphaFromIntensity(e.intensity, 0.08, 0.2);
            pts.forEach((p, idx) => {
                const pp = map.latLngToContainerPoint([p.lat, p.lng]);
                const r = metresToPixels(map, p, e.radiusMetres || 650) * (0.7 + (idx % 3) * 0.15);
                const pulse = 1 + (Math.sin((timeSec * 1.3) + idx) * 0.06);

                // Gaussian rings provide smoother density blending than linear gradients.
                const rings = 8;
                for (let i = rings; i >= 1; i -= 1) {
                    const norm = i / rings;
                    const ringRadius = r * norm * pulse;
                    const gauss = gaussianAlpha(norm, 0.45);
                    const ringAlpha = clamp(baseAlpha * gauss * 0.45, 0.008, 0.16);
                    gHotspot.beginFill(color, ringAlpha);
                    gHotspot.drawCircle(pp.x, pp.y, ringRadius);
                    gHotspot.endFill();
                }

                gHotspot.beginFill(0xfff8db, clamp(baseAlpha * 0.32, 0.03, 0.12));
                gHotspot.drawCircle(pp.x, pp.y, r * 0.13 * pulse);
                gHotspot.endFill();
            });
        });
    }

    function _drawCorridors(timeSec) {
        gCorridor.clear();
        activeEffects.filter((e) => e.effectType === "CORRIDOR_FLOW" || e.effectType === "ROAD_BUILD").forEach((e) => {
            const path = e.pathCoords || [];
            if (path.length < 2) return;
            const color = categoryColor(e.category);
            const pts = path.map((p) => map.latLngToContainerPoint([p.lat, p.lng]));
            const metrics = _buildPathMetrics(pts);
            if (!metrics.total) return;

            gCorridor.lineStyle(8, color, 0.18);
            gCorridor.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i += 1) gCorridor.lineTo(pts[i].x, pts[i].y);
            gCorridor.lineStyle(3, color, 0.58);
            gCorridor.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i += 1) gCorridor.lineTo(pts[i].x, pts[i].y);

            // Shader-like flow cues: multiple moving light segments along the corridor direction.
            const segmentCount = 4;
            const trailNorm = 0.1;
            const speed = 0.16 + (clamp(e.intensity, 0, 1) * 0.28);

            for (let seg = 0; seg < segmentCount; seg += 1) {
                const headT = ((timeSec * speed) + (seg / segmentCount)) % 1;
                const samples = 8;
                for (let s = 0; s < samples; s += 1) {
                    const fade = 1 - (s / (samples - 1));
                    let t = headT - ((s / (samples - 1)) * trailNorm);
                    if (t < 0) t += 1;
                    const pt = _pointAtDistance(pts, metrics, metrics.total * t);
                    if (!pt) continue;
                    gCorridor.beginFill(0xfff0bf, 0.12 + (fade * 0.4));
                    gCorridor.drawCircle(pt.x, pt.y, 1.5 + (fade * (2.6 + e.intensity * 1.4)));
                    gCorridor.endFill();
                }
            }
        });
    }

    function _buildPathMetrics(path) {
        const cumulative = [0];
        let total = 0;
        for (let i = 1; i < path.length; i += 1) {
            total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
            cumulative.push(total);
        }
        return { cumulative, total };
    }

    function _pointAtDistance(path, metrics, distancePx) {
        if (path.length < 2 || !metrics.total) return path[0] || null;
        const d = clamp(distancePx, 0, metrics.total);
        for (let i = 1; i < path.length; i += 1) {
            const start = metrics.cumulative[i - 1];
            const end = metrics.cumulative[i];
            if (d <= end) {
                const segLen = Math.max(0.0001, end - start);
                const r = (d - start) / segLen;
                return {
                    x: path[i - 1].x + ((path[i].x - path[i - 1].x) * r),
                    y: path[i - 1].y + ((path[i].y - path[i - 1].y) * r),
                };
            }
        }
        return path[path.length - 1];
    }

    function _drawRadialAndAlerts(timeSec) {
        gRadial.clear();
        gAlerts.clear();
        activeEffects.filter((e) => e.effectType === "RADIAL_ZONE").forEach((e) => {
            if (!e.geoPoint) return;
            const p = map.latLngToContainerPoint([e.geoPoint.lat, e.geoPoint.lng]);
            const radiusPx = metresToPixels(map, e.geoPoint, e.radiusMetres || 850);
            const color = categoryColor(e.category);
            const pulse = 1 + (Math.sin(timeSec * 2.2) * 0.08);
            gRadial.lineStyle(2.2, color, 0.72);
            gRadial.beginFill(color, 0.08);
            gRadial.drawCircle(p.x, p.y, radiusPx * pulse);
            gRadial.endFill();
            gAlerts.lineStyle(2, color, 0.58);
            gAlerts.drawCircle(p.x, p.y, radiusPx * (1.15 + (Math.sin(timeSec * 3.2) * 0.08)));
        });
    }

    function _drawDiseaseAndTemp(timeSec) {
        gSmog.clear();
        gTemp.clear();
        const smog = activeEffects.filter((e) => e.effectType === "DISEASE_SMOG");
        smog.forEach((e) => {
            const pts = e.heatPoints.length ? e.heatPoints : (e.geoPoint ? [e.geoPoint] : []);
            pts.forEach((p, i) => {
                const pp = map.latLngToContainerPoint([p.lat, p.lng]);
                const rr = metresToPixels(map, p, e.radiusMetres || 620) * (0.72 + ((i % 4) * 0.12));
                const wobble = 1 + (Math.sin((timeSec * 1.7) + i) * 0.08);
                gSmog.beginFill(0x49d86f, alphaFromIntensity(e.intensity, 0.06, 0.18));
                gSmog.drawEllipse(pp.x, pp.y, rr * 1.16 * wobble, rr * 0.78 * wobble);
                gSmog.endFill();
            });
        });
        const tempFx = activeEffects.filter((e) => e.effectType === "TEMP_RISE" || e.effectType === "TEMP_DROP");
        tempFx.forEach((e, idx) => {
            const cool = e.effectType === "TEMP_DROP";
            const pts = e.heatPoints.length ? e.heatPoints : (e.geoPoint ? [e.geoPoint] : []);
            pts.forEach((p) => {
                const pp = map.latLngToContainerPoint([p.lat, p.lng]);
                const r = metresToPixels(map, p, e.radiusMetres || 720);
                const pulse = 1 + (Math.sin(timeSec * 1.5 + idx) * 0.06);
                gTemp.beginFill(cool ? 0x5bb6ff : 0xff7f3a, alphaFromIntensity(e.intensity, 0.06, 0.18));
                gTemp.drawCircle(pp.x, pp.y, r * pulse);
                gTemp.endFill();
            });
        });
    }

    function _drawThunder(timeSec) {
        gStorm.clear();
        const storms = activeEffects.filter((e) => e.effectType === "THUNDERSTORM");
        if (!storms.length) return;
        storms.forEach((e, idx) => {
            if (!e.geoPoint) return;
            const flash = Math.max(0, Math.sin((timeSec * 3.2) + (idx * 2.8)));
            if (flash < 0.88) return;
            const p = map.latLngToContainerPoint([e.geoPoint.lat, e.geoPoint.lng]);
            const r = metresToPixels(map, e.geoPoint, e.radiusMetres || 1100);
            gStorm.beginFill(0xdfecff, 0.14 + flash * 0.26);
            gStorm.drawCircle(p.x, p.y, r);
            gStorm.endFill();
        });
    }

    function _drawMarkersAndSkulls(timeSec) {
        gMarkers.clear();
        gSkulls.clear();
        activeEffects.filter((e) => e.effectType === "EVENT_MARKER_3D").forEach((e, i) => {
            const pts = e.geometrySource === "multiPoints" ? e.multiPoints : (e.geoPoint ? [e.geoPoint] : []);
            const color = categoryColor(e.category);
            pts.forEach((p, pi) => {
                const pp = map.latLngToContainerPoint([p.lat, p.lng]);
                const pulse = 1 + (Math.sin((timeSec * 2) + i + pi) * 0.08);
                gMarkers.beginFill(0x0a1110, 0.28);
                gMarkers.drawEllipse(pp.x + 7, pp.y + 8, 9, 5);
                gMarkers.endFill();
                gMarkers.beginFill(color, 0.9);
                gMarkers.drawCircle(pp.x, pp.y - 8, 9 * pulse);
                gMarkers.endFill();
                gMarkers.beginFill(0xffffff, 0.85);
                gMarkers.drawCircle(pp.x, pp.y - 8, 3.1);
                gMarkers.endFill();
                gAlerts.lineStyle(2, color, 0.36);
                gAlerts.drawCircle(pp.x, pp.y - 8, 14 + (Math.sin(timeSec * 3 + pi) * 2));
            });
        });
        activeEffects.filter((e) => e.effectType === "SKULL_SIGNS").forEach((e) => {
            const pts = e.multiPoints.length ? e.multiPoints : (e.heatPoints.length ? e.heatPoints : (e.geoPoint ? [e.geoPoint] : []));
            pts.forEach((p, idx) => {
                const pp = map.latLngToContainerPoint([p.lat, p.lng]);
                const size = 8 + (Math.sin(timeSec * 3.5 + idx) * 1.2);
                gSkulls.lineStyle(2, 0x8fff9f, 0.9);
                gSkulls.moveTo(pp.x - size, pp.y - size);
                gSkulls.lineTo(pp.x + size, pp.y + size);
                gSkulls.moveTo(pp.x + size, pp.y - size);
                gSkulls.lineTo(pp.x - size, pp.y + size);
            });
        });
    }

    function _drawRainAndFire(timeSec, dtSec) {
        const rainFx = activeEffects.filter((e) => e.effectType === "RAIN_3D");
        rainLayer.update(rainFx, dtSec);

        gFire.clear();

        activeEffects.filter((e) => e.effectType === "FIRE_INCIDENT").forEach((e, ei) => {
            if (!e.geoPoint) return;
            const c = map.latLngToContainerPoint([e.geoPoint.lat, e.geoPoint.lng]);
            const flameCount = Math.max(12, Math.floor(14 + (e.intensity * 24 * e.fireScale)));
            for (let i = 0; i < flameCount; i += 1) {
                const phase = timeSec * (2.2 + (i % 4) * 0.2) + i;
                const ox = Math.sin(phase * 0.9) * (2 + (i % 5));
                const oy = Math.cos(phase * 1.1) * (1 + (i % 3));
                const h = 6 + ((i % 6) * 1.4) + (Math.sin(phase) * 1.5);
                gFire.beginFill(0xff6f2d, 0.65);
                gFire.drawEllipse(c.x + ox, c.y + oy, 3.2, h);
                gFire.endFill();
                if (i % 3 === 0) {
                    gFire.beginFill(0xffd06a, 0.48);
                    gFire.drawEllipse(c.x + ox * 0.6, c.y + oy * 0.6, 2.2, h * 0.55);
                    gFire.endFill();
                }
            }
            gFire.beginFill(0x2d2d2d, 0.16);
            gFire.drawCircle(c.x, c.y + 10, 16 + (Math.sin(timeSec * 1.4 + ei) * 2));
            gFire.endFill();
        });
    }

    function update(dtSec) {
        const t = (performance.now() * 0.001);
        _drawHazardZones();
        _drawHotspots(t);
        _drawCorridors(t);
        _drawRadialAndAlerts(t);
        _drawDiseaseAndTemp(t);
        _drawThunder(t);
        _drawMarkersAndSkulls(t);
        _drawRainAndFire(t, dtSec);
        diffusion.update(dtSec);
    }

    function getInteractionAt(containerPoint) {
        if (!containerPoint) return null;
        let best = null;
        let bestDist = Infinity;

        interactionItems.forEach((it) => {
            const c = map.latLngToContainerPoint([it.center.lat, it.center.lng]);
            const radiusPx = metresToPixels(map, it.center, it.radiusMetres || 600);
            const d = Math.hypot(containerPoint.x - c.x, containerPoint.y - c.y);
            if (d <= Math.max(14, radiusPx) && d < bestDist) {
                bestDist = d;
                best = {
                    eventId: it.eventId,
                    title: it.title,
                    summary: it.summary,
                    category: it.category,
                    effectType: it.effectType,
                    containerPoint: c,
                };
            }
        });

        if (best) return best;

        for (let i = 0; i < activeEffects.length; i += 1) {
            const e = activeEffects[i];
            if (!e.pathCoords?.length) continue;
            const pts = e.pathCoords.map((p) => map.latLngToContainerPoint([p.lat, p.lng]));
            for (let s = 1; s < pts.length; s += 1) {
                const d = pointDistanceToSegment(containerPoint.x, containerPoint.y, pts[s - 1].x, pts[s - 1].y, pts[s].x, pts[s].y);
                if (d <= 10) {
                    return {
                        eventId: e.eventId,
                        title: e.title,
                        summary: e.summary,
                        category: e.category,
                        effectType: e.effectType,
                        containerPoint: containerPoint,
                    };
                }
            }
        }
        return null;
    }

    function getStats() {
        return {
            layerCount: 7,
            eventCount: activeEffects.length,
            shaderLoaded: !!shaderSource,
        };
    }

    function destroy() {
        diffusion.destroy();
        if (rainLayer.container.parent) {
            rainLayer.container.parent.removeChild(rainLayer.container);
        }
        rainLayer.destroy();
        Object.values(layers).forEach((l) => l.destroy({ children: true }));
    }

    return {
        setEvents,
        setLayerVisible,
        update,
        getInteractionAt,
        getStats,
        destroy,
    };
}

