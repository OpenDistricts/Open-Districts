import * as CanvasBackend from "./effects-canvas2d-controller.js";
import * as DeckBackend from "./effects-deckgl-controller.js";
import { detectAdvancedEffectsSupport } from "../services/webgl-capability.js";
import { resolveEffectsBackend } from "../services/effects-backend-resolver.js";

let _ctx;
let _backend = "off";
let _lastReason = null;
let _debugBadge;

export function init(ctx) {
    _ctx = ctx;
    CanvasBackend.init(ctx);
    DeckBackend.init(ctx);
}

export function setMap(mapInstance) {
    CanvasBackend.setMap(mapInstance);
    DeckBackend.setMap(mapInstance);
    _mountDebugBadge(mapInstance);
}

export function syncMode({ mode, isHistorical, connectionStatus, envEnabled }) {
    const capabilities = detectAdvancedEffectsSupport();
    const selected = resolveEffectsBackend({ mode, isHistorical, connectionStatus, capabilities });

    if (selected.backend !== _backend) {
        CanvasBackend.suspendForHistorical();
        DeckBackend.suspendForHistorical();
    }

    _backend = selected.backend;
    _lastReason = selected.degradedReason;

    if (_backend === "deckgl") {
        DeckBackend.syncMode({ mode, isHistorical, connectionStatus, envEnabled });
        const deckStats = DeckBackend.getStats();
        if (!deckStats.active && capabilities.canvas2d) {
            _backend = "canvas2d";
            _lastReason = deckStats.degradedReason || "deckgl_runtime_failed";
            CanvasBackend.syncMode({ mode, isHistorical, connectionStatus, envEnabled });
        }
    } else if (_backend === "canvas2d") {
        CanvasBackend.syncMode({ mode, isHistorical, connectionStatus, envEnabled });
    } else {
        CanvasBackend.suspendForHistorical();
        DeckBackend.suspendForHistorical();
    }
    _syncStatus();
}

export function renderForEvents(events) {
    if (_backend === "deckgl") DeckBackend.renderForEvents(events);
    if (_backend === "canvas2d") CanvasBackend.renderForEvents(events);
    _syncStatus();
}

export function suspendForHistorical() {
    CanvasBackend.suspendForHistorical();
    DeckBackend.suspendForHistorical();
    _backend = "off";
    _lastReason = "historical_mode_disabled_v1";
    _syncStatus();
}

function _syncStatus() {
    let stats = { active: false, layers: 0, qualityTier: "high", degradedReason: _lastReason };
    if (_backend === "deckgl") stats = DeckBackend.getStats();
    if (_backend === "canvas2d") stats = CanvasBackend.getStats();
    if (_ctx?.state) {
        _ctx.state.advancedEffectsStatus = {
            active: !!stats.active,
            backend: _backend,
            qualityTier: stats.qualityTier || "high",
            layers: stats.layers || 0,
            degradedReason: stats.degradedReason ?? _lastReason,
        };
    }
    _updateDebugBadge(_ctx?.state?.advancedEffectsStatus);
}

function _mountDebugBadge(mapInstance) {
    try {
        const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:";
        if (!isDev || !mapInstance?.getContainer) return;
        const container = mapInstance.getContainer();
        if (!container || _debugBadge) return;
        _debugBadge = document.createElement("div");
        _debugBadge.className = "advanced-effects-debug-badge";
        container.appendChild(_debugBadge);
        _updateDebugBadge({
            active: false,
            backend: "off",
            qualityTier: "high",
            layers: 0,
            degradedReason: null,
        });
    } catch (_) {
        // Debug badge is optional.
    }
}

function _updateDebugBadge(status) {
    if (!_debugBadge || !status) return;
    const reason = status.degradedReason ? ` (${status.degradedReason})` : "";
    _debugBadge.textContent = `FX ${status.backend} | ${status.layers} layers | ${status.qualityTier}${reason}`;
}
