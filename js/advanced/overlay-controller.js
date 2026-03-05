export function createOverlay(map, options = {}) {
    if (!map?.getContainer) {
        throw new Error("overlay-controller: map instance missing");
    }
    if (!window?.PIXI?.Application) {
        throw new Error("overlay-controller: PIXI global missing");
    }

    const container = map.getContainer();
    const host = document.createElement("div");
    host.className = "advanced-effects-host advanced-effects-host--pixi";
    host.style.position = "absolute";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = String(options.zIndex ?? 470);

    container.appendChild(host);
    const rect = host.getBoundingClientRect();
    const app = new window.PIXI.Application({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
        antialias: true,
        autoDensity: true,
        resolution: Math.max(1, window.devicePixelRatio || 1),
        backgroundAlpha: 0,
    });
    app.view.className = "advanced-effects-canvas";
    host.appendChild(app.view);

    const resize = () => {
        const rect = host.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        app.renderer.resize(width, height);
    };

    map.on("resize", resize);
    resize();

    return {
        app,
        host,
        destroy() {
            map.off("resize", resize);
            app.destroy(true, { children: true, texture: true });
            if (host.parentNode) host.parentNode.removeChild(host);
        },
    };
}
