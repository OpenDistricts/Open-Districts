import * as CanvasBackend from "./effects-canvas2d-controller.js";
import * as PixiBackend from "./effects-pixi-controller.js";
import { detectAdvancedEffectsSupport } from "../services/webgl-capability.js";
import { resolveEffectsBackend } from "../services/effects-backend-resolver.js";

let _ctx;
let _backend = "off";
let _lastReason = null;
let _debugBadge;
let _debugVisible = false;
let _mapContainer;

export function init(ctx) {
    _ctx = ctx;
    CanvasBackend.init(ctx);
    PixiBackend.init(ctx);
}

export function setMap(mapInstance) {
    CanvasBackend.setMap(mapInstance);
    PixiBackend.setMap(mapInstance);
    _mapContainer = mapInstance?.getContainer?.() || null;
    _mountDebugBadge(mapInstance);
}

export function syncMode({ mode, isHistorical, connectionStatus, envEnabled }) {
    const capabilities = detectAdvancedEffectsSupport();
    const selected = resolveEffectsBackend({ mode, isHistorical, connectionStatus, capabilities });

    if (selected.backend !== _backend) {
        CanvasBackend.suspendForHistorical();
        PixiBackend.suspendForHistorical();
    }

    _backend = selected.backend;
    _lastReason = selected.degradedReason;

    if (_backend === "pixi") {
        PixiBackend.syncMode({ mode, isHistorical, connectionStatus, envEnabled });
        const pixiStats = PixiBackend.getStats();
        if (!pixiStats.active && capabilities.canvas2d) {
            _backend = "canvas2d";
            _lastReason = pixiStats.degradedReason || "pixi_runtime_failed";
            CanvasBackend.syncMode({ mode, isHistorical, connectionStatus, envEnabled });
        }
    } else if (_backend === "canvas2d") {
        CanvasBackend.syncMode({ mode, isHistorical, connectionStatus, envEnabled });
    } else {
        CanvasBackend.suspendForHistorical();
        PixiBackend.suspendForHistorical();
    }
    _syncStatus();
}

export function renderForEvents(events) {
    if (_backend === "pixi") PixiBackend.renderForEvents(events);
    if (_backend === "canvas2d") CanvasBackend.renderForEvents(events);
    _syncStatus();
}

export function suspendForHistorical() {
    CanvasBackend.suspendForHistorical();
    PixiBackend.suspendForHistorical();
    _backend = "off";
    _lastReason = "historical_mode_disabled_v1";
    _syncStatus();
}

export function setDebugVisibility(enabled) {
    _debugVisible = !!enabled;
    if (_debugBadge) {
        _debugBadge.style.display = _debugVisible ? "block" : "none";
    }
}

function _syncStatus() {
    let stats = { active: false, layers: 0, qualityTier: "high", degradedReason: _lastReason };
    if (_backend === "pixi") stats = PixiBackend.getStats();
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
    if (_mapContainer) {
        _mapContainer.classList.toggle("fx-backend-pixi", _backend === "pixi");
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
        _debugBadge.style.display = _debugVisible ? "block" : "none";
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
