const MIN_FOG_SPRITES = 10;
const MAX_FOG_SPRITES = 30;

function toRad(deg) {
    return (deg * Math.PI) / 180;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function metresToPixels(map, latLng, metres) {
    const center = map.latLngToContainerPoint([latLng.lat, latLng.lng]);
    const north = map.latLngToContainerPoint([
        latLng.lat + (metres / 111320),
        latLng.lng,
    ]);
    return Math.max(0.2, Math.hypot(north.x - center.x, north.y - center.y));
}

function buildFogTexture() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        return window.PIXI.Texture.WHITE;
    }

    ctx.clearRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.08, size * 0.5, size * 0.5, size * 0.5);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.34, "rgba(255,255,255,0.56)");
    grad.addColorStop(0.72, "rgba(255,255,255,0.16)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Stamp low-alpha blobs to avoid a perfect radial look.
    for (let i = 0; i < 26; i += 1) {
        const r = 6 + (Math.random() * 18);
        const x = (size * 0.2) + (Math.random() * size * 0.6);
        const y = (size * 0.2) + (Math.random() * size * 0.6);
        ctx.fillStyle = `rgba(255,255,255,${(0.03 + Math.random() * 0.06).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    return window.PIXI.Texture.from(canvas);
}

export function createDiffusionLayer({ map, layerName = "diffusion-particles" }) {
    const container = new window.PIXI.Container();
    container.name = layerName;
    container.sortableChildren = false;
    container.blendMode = window.PIXI.BLEND_MODES.SCREEN;

    const texture = buildFogTexture();
    const states = new Map();

    function createFogState() {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * 0.95;
        return {
            xNorm: Math.cos(angle) * radius,
            yNorm: Math.sin(angle) * radius,
            sizeFactor: 0.3 + (Math.random() * 0.5), // radius * [0.3, 0.8]
            aspect: 0.72 + (Math.random() * 0.5),
            baseAlpha: 0.08 + (Math.random() * 0.1), // [0.08, 0.18]
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.45 + (Math.random() * 1.1),
        };
    }

    function createFogSprite() {
        const sprite = new window.PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.tint = 0xcdb182;
        sprite.blendMode = Math.random() > 0.35 ? window.PIXI.BLEND_MODES.SCREEN : window.PIXI.BLEND_MODES.ADD;
        container.addChild(sprite);
        return {
            sprite,
            fog: createFogState(),
        };
    }

    function targetFogCount(intensity) {
        const i = clamp(Number(intensity ?? 0.6), 0, 1);
        return Math.round(MIN_FOG_SPRITES + (i * (MAX_FOG_SPRITES - MIN_FOG_SPRITES)));
    }

    function alignCount(entry, targetCount) {
        while (entry.items.length < targetCount) {
            entry.items.push(createFogSprite());
        }
        while (entry.items.length > targetCount) {
            const removed = entry.items.pop();
            if (!removed) break;
            container.removeChild(removed.sprite);
            removed.sprite.destroy();
        }
    }

    function respawnOppositeWind(fog, windRad) {
        const dirX = Math.cos(windRad);
        const dirY = -Math.sin(windRad);
        const perpX = -dirY;
        const perpY = dirX;

        const depth = 0.68 + (Math.random() * 0.28);
        const lateral = (Math.random() - 0.5) * 0.9;
        fog.xNorm = (-dirX * depth) + (perpX * lateral);
        fog.yNorm = (-dirY * depth) + (perpY * lateral);

        const n = Math.max(0.0001, Math.hypot(fog.xNorm, fog.yNorm));
        if (n > 0.98) {
            fog.xNorm = (fog.xNorm / n) * 0.98;
            fog.yNorm = (fog.yNorm / n) * 0.98;
        }
    }

    function upsertEvent(event) {
        const key = event.id;
        const current = states.get(key);
        if (current) {
            current.event = event;
            alignCount(current, targetFogCount(event.intensity));
            return;
        }

        const entry = { event, items: [] };
        alignCount(entry, targetFogCount(event.intensity));
        states.set(key, entry);
    }

    function removeMissing(activeIds) {
        states.forEach((entry, id) => {
            if (activeIds.has(id)) return;
            entry.items.forEach((item) => {
                container.removeChild(item.sprite);
                item.sprite.destroy();
            });
            states.delete(id);
        });
    }

    function update(dt) {
        const now = performance.now() * 0.001;
        states.forEach((entry) => {
            const event = entry.event;
            if (!event?.geoPoint) return;

            alignCount(entry, targetFogCount(event.intensity));

            const center = map.latLngToContainerPoint([event.geoPoint.lat, event.geoPoint.lng]);
            const radiusMetres = clamp(Number(event.radiusMetres ?? 900), 100, 5000);
            const radiusPx = metresToPixels(map, event.geoPoint, radiusMetres);
            const windBearing = Number(event.windBearing ?? 25);
            const windSpeedKmh = clamp(Number(event.windSpeedKmh ?? 8), 0, 120);
            const windRad = toRad(windBearing);
            const windStepNorm = ((windSpeedKmh * 0.02) * dt) / Math.max(1, radiusPx);
            const windXNorm = Math.cos(windRad) * windStepNorm;
            const windYNorm = -Math.sin(windRad) * windStepNorm;
            const intensityBoost = 0.85 + (clamp(Number(event.intensity ?? 0.6), 0, 1) * 0.35);

            for (let i = 0; i < entry.items.length; i += 1) {
                const { fog, sprite } = entry.items[i];
                const swirlX = Math.cos((now * fog.wobbleSpeed) + fog.wobblePhase) * 0.008 * dt;
                const swirlY = Math.sin((now * (fog.wobbleSpeed * 0.92)) + fog.wobblePhase) * 0.008 * dt;

                fog.xNorm += windXNorm + swirlX;
                fog.yNorm += windYNorm + swirlY;

                const distNorm = Math.hypot(fog.xNorm, fog.yNorm);
                if (distNorm > 1.08) {
                    respawnOppositeWind(fog, windRad);
                }

                const d = Math.hypot(fog.xNorm, fog.yNorm);
                const edgeFade = clamp(1 - d, 0, 1); // opacity *= (1 - distance / radius)
                const breathe = 0.94 + (Math.sin((now * 0.4) + fog.wobblePhase) * 0.08);
                const widthPx = Math.max(8, radiusPx * fog.sizeFactor * breathe);
                const heightPx = Math.max(6, widthPx * fog.aspect);

                sprite.x = center.x + (fog.xNorm * radiusPx);
                sprite.y = center.y + (fog.yNorm * radiusPx);
                sprite.width = widthPx;
                sprite.height = heightPx;
                sprite.alpha = clamp(fog.baseAlpha * edgeFade * intensityBoost, 0.02, 0.18);
            }
        });
    }

    function destroy() {
        states.forEach((entry) => {
            entry.items.forEach((item) => item.sprite.destroy());
        });
        states.clear();
        container.destroy({ children: true });
        if (texture !== window.PIXI.Texture.WHITE) {
            texture.destroy(true);
        }
    }

    return {
        container,
        upsertEvent,
        removeMissing,
        update,
        destroy,
    };
}

