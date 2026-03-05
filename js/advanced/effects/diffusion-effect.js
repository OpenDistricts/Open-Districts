const DEFAULT_PARTICLES = 180;
const MAX_PARTICLES = 500;

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

function buildParticleTexture(app) {
    const g = new window.PIXI.Graphics();
    g.beginFill(0xf4d992, 1);
    g.drawCircle(0, 0, 8);
    g.endFill();
    const tex = app.renderer.generateTexture(g, {
        resolution: 1,
        scaleMode: window.PIXI.SCALE_MODES.LINEAR,
    });
    g.destroy();
    return tex;
}

export function createDiffusionLayer({ app, map, layerName = "diffusion-particles" }) {
    const container = new window.PIXI.ParticleContainer(MAX_PARTICLES, {
        position: true,
        scale: true,
        alpha: true,
        rotation: false,
        uvs: false,
        tint: true,
    });
    container.name = layerName;
    container.sortableChildren = false;

    const texture = buildParticleTexture(app);
    const states = new Map();

    function upsertEvent(event) {
        const key = event.id;
        const current = states.get(key);
        if (current) {
            current.event = event;
            return;
        }
        const intensity = clamp(Number(event.intensity ?? 0.65), 0.15, 1);
        const count = Math.min(
            MAX_PARTICLES,
            Math.max(80, Math.floor(DEFAULT_PARTICLES + intensity * 160))
        );
        const sprites = [];
        const particles = [];
        for (let i = 0; i < count; i += 1) {
            const s = new window.PIXI.Sprite(texture);
            s.anchor.set(0.5);
            s.alpha = 0.15 + Math.random() * 0.35;
            s.tint = 0xbaa060;
            s.blendMode = window.PIXI.BLEND_MODES.SCREEN;
            container.addChild(s);
            sprites.push(s);
            particles.push({
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                age: Math.random(),
                life: 2.2 + Math.random() * 3.6,
                spread: 0.6 + Math.random() * 1.2,
                rseed: Math.random(),
            });
        }
        states.set(key, { event, sprites, particles });
    }

    function removeMissing(activeIds) {
        states.forEach((entry, id) => {
            if (activeIds.has(id)) return;
            entry.sprites.forEach((s) => {
                container.removeChild(s);
                s.destroy();
            });
            states.delete(id);
        });
    }

    function update(dt) {
        states.forEach((entry) => {
            const event = entry.event;
            if (!event?.geoPoint) return;
            const center = map.latLngToContainerPoint([event.geoPoint.lat, event.geoPoint.lng]);
            const radiusMetres = clamp(Number(event.radiusMetres ?? 900), 100, 5000);
            const radiusPx = metresToPixels(map, event.geoPoint, radiusMetres);
            const windBearing = Number(event.windBearing ?? 25);
            const windSpeedKmh = clamp(Number(event.windSpeedKmh ?? 8), 0, 80);
            const windRad = toRad(windBearing);
            const windPx = metresToPixels(map, event.geoPoint, (windSpeedKmh * 1000) / 3600) * 0.35;
            const wx = Math.cos(windRad) * windPx;
            const wy = -Math.sin(windRad) * windPx;
            const profile = String(event.diffusionProfile || "gaussian");
            const spreadFactor = profile === "anisotropic" ? 1.6 : 1;
            const radialSpeed = Math.max(2, radiusPx * 0.08) * spreadFactor;

            for (let i = 0; i < entry.sprites.length; i += 1) {
                const p = entry.particles[i];
                const s = entry.sprites[i];
                p.age += dt;
                if (p.age >= p.life) {
                    const a = Math.random() * Math.PI * 2;
                    const rr = Math.random() * radiusPx * 0.18;
                    p.x = Math.cos(a) * rr;
                    p.y = Math.sin(a) * rr;
                    p.vx = Math.cos(a) * radialSpeed * p.spread;
                    p.vy = Math.sin(a) * radialSpeed * p.spread;
                    p.age = 0;
                    p.life = 2.2 + Math.random() * 3.6;
                    p.rseed = Math.random();
                }
                const wobbleX = Math.sin((p.age + p.rseed) * 2.4) * 2.4;
                const wobbleY = Math.cos((p.age + p.rseed) * 2.1) * 1.8;
                p.x += (p.vx + wx + wobbleX) * dt;
                p.y += (p.vy + wy + wobbleY) * dt;

                const dist = Math.hypot(p.x, p.y);
                const norm = dist / Math.max(1, radiusPx);
                if (norm > 1.2) {
                    p.age = p.life + 1;
                }
                const opacity = Math.exp(-norm);
                s.x = center.x + p.x;
                s.y = center.y + p.y;
                s.alpha = clamp(opacity * 0.58, 0.04, 0.65);
                const scale = 0.12 + (1 - norm) * 0.42;
                s.scale.set(scale, scale);
            }
        });
    }

    function destroy() {
        states.forEach((entry) => {
            entry.sprites.forEach((s) => s.destroy());
        });
        states.clear();
        container.destroy({ children: true });
        texture.destroy(true);
    }

    return {
        container,
        upsertEvent,
        removeMissing,
        update,
        destroy,
    };
}

