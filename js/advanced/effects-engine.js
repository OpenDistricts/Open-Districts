import { createDiffusionLayer } from "./effects/diffusion-effect.js";
import { resolveAdvancedEffectsForEvent } from "../services/effect-resolver.js";

function normalizeDiffusionEvent(event) {
    const resolved = resolveAdvancedEffectsForEvent(event);
    const plumeFx = resolved.effects.find((fx) => fx.type === "GAS_PLUME_3D" && fx.enabled !== false);
    const wantsDiffusion = event.renderAs === "diffusion" || !!plumeFx;
    if (!wantsDiffusion) return null;
    if (!event?.geoPoint) return null;

    const meta = event.meta || {};
    const params = plumeFx?.params || {};
    return {
        id: event.id,
        title: event.title || event.id,
        summary: event.summary || "",
        category: event.category || "unknown",
        effectType: "GAS_PLUME_3D",
        renderAs: event.renderAs || "diffusion",
        geoPoint: event.geoPoint,
        intensity: plumeFx?.intensity ?? meta.intensity ?? 0.65,
        radiusMetres: meta.radiusMetres ?? params.radiusMetres ?? 1100,
        windBearing: meta.windBearing ?? params.windBearing ?? 35,
        windSpeedKmh: meta.windSpeedKmh ?? params.windSpeedKmh ?? 10,
        diffusionProfile: meta.diffusionProfile ?? params.diffusionProfile ?? "gaussian",
    };
}

async function loadShaderSource() {
    const fallback = `#shader-set: diffusion-particles
// Placeholder bundle for forward shader migration.
// This v1 Pixi implementation uses sprite batching for speed and compatibility.
`;
    try {
        const url = new URL("../../shaders/particle-shaders.glsl", import.meta.url);
        const res = await fetch(url);
        if (!res.ok) return fallback;
        return await res.text();
    } catch (_) {
        return fallback;
    }
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

    const zOrder = {
        basemap: 1,
        admin: 2,
        corridor: 3,
        diffusion: 4,
        particles: 5,
        markers: 6,
        alerts: 7,
    };

    Object.entries(layers).forEach(([k, c]) => {
        c.name = `fx-${k}`;
        c.zIndex = zOrder[k];
        stage.addChild(c);
    });

    const toggles = {
        basemap: true,
        admin: true,
        corridor: true,
        diffusion: true,
        particles: true,
        markers: true,
        alerts: true,
    };

    const diffusion = createDiffusionLayer({
        app,
        map,
        layerName: "diffusion-plume",
    });
    layers.particles.addChild(diffusion.container);

    let activeEvents = [];
    let shaderSource = "";
    loadShaderSource().then((src) => {
        shaderSource = src;
    });

    function setLayerVisible(layerName, visible) {
        if (!(layerName in toggles)) return;
        toggles[layerName] = !!visible;
        layers[layerName].visible = toggles[layerName];
    }

    function setEvents(events) {
        activeEvents = (events || [])
            .map((ev) => normalizeDiffusionEvent(ev))
            .filter(Boolean);
        const ids = new Set();
        activeEvents.forEach((ev) => {
            ids.add(ev.id);
            diffusion.upsertEvent(ev);
        });
        diffusion.removeMissing(ids);
    }

    function update(dtSec) {
        diffusion.update(dtSec);
    }

    function _metresToPixels(latLng, metres) {
        const center = map.latLngToContainerPoint([latLng.lat, latLng.lng]);
        const north = map.latLngToContainerPoint([
            latLng.lat + (metres / 111320),
            latLng.lng,
        ]);
        return Math.max(1, Math.hypot(north.x - center.x, north.y - center.y));
    }

    function getInteractionAt(containerPoint) {
        if (!containerPoint) return null;
        let best = null;
        let bestDist = Infinity;
        activeEvents.forEach((ev) => {
            const c = map.latLngToContainerPoint([ev.geoPoint.lat, ev.geoPoint.lng]);
            const radiusPx = _metresToPixels(ev.geoPoint, ev.radiusMetres);
            const dx = containerPoint.x - c.x;
            const dy = containerPoint.y - c.y;
            const d = Math.hypot(dx, dy);
            const hitRadius = Math.max(18, radiusPx * 0.9);
            if (d <= hitRadius && d < bestDist) {
                bestDist = d;
                best = {
                    eventId: ev.id,
                    title: ev.title,
                    summary: ev.summary,
                    category: ev.category,
                    effectType: ev.effectType,
                    renderAs: ev.renderAs,
                    intensity: ev.intensity,
                    radiusMetres: ev.radiusMetres,
                    windBearing: ev.windBearing,
                    windSpeedKmh: ev.windSpeedKmh,
                    containerPoint: c,
                };
            }
        });
        return best;
    }

    function getStats() {
        return {
            layerCount: activeEvents.length ? 1 : 0,
            eventCount: activeEvents.length,
            shaderLoaded: !!shaderSource,
        };
    }

    function destroy() {
        diffusion.destroy();
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
