export function resolveEffectsBackend({ mode, isHistorical, connectionStatus, capabilities }) {
    if (mode !== "live") {
        return { backend: "off", degradedReason: "mode_not_live" };
    }
    if (isHistorical) {
        return { backend: "off", degradedReason: "historical_mode_disabled_v1" };
    }
    if (connectionStatus !== "live") {
        return { backend: "off", degradedReason: "connection_not_live" };
    }
    if (!capabilities?.supported) {
        return { backend: "off", degradedReason: "no_render_backend_available" };
    }
    if (capabilities.webgl && capabilities.deckGlobal) {
        return { backend: "deckgl", degradedReason: null };
    }
    if (capabilities.canvas2d) {
        return {
            backend: "canvas2d",
            degradedReason: capabilities.webgl ? "deckgl_global_missing" : "webgl_unavailable",
        };
    }
    return { backend: "off", degradedReason: "no_render_backend_available" };
}

