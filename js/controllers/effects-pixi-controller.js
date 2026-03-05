import { createOverlay } from "../advanced/overlay-controller.js";
import { createEffectsEngine } from "../advanced/effects-engine.js";
import { createQualityManager } from "../services/quality-manager.js";
import { detectAdvancedEffectsSupport } from "../services/webgl-capability.js";

let _ctx;
let _map;
let _quality;
let _overlay = null;
let _engine = null;
let _active = false;
let _raf = 0;
let _lastTs = 0;
let _degradedReason = null;
let _tooltipEl = null;
let _pinnedTarget = null;
let _hoveringEffect = false;

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
        _unmount();
        return;
    }
    const cap = detectAdvancedEffectsSupport();
    if (!cap?.pixiGlobal || !cap?.webgl) {
        _degradedReason = !cap?.pixiGlobal ? "pixi_missing" : "webgl_unavailable";
        _unmount();
        return;
    }
    _mountIfNeeded();
    _render(_ctx?.state?.events || []);
}

export function renderForEvents(events) {
    if (!_active || !_engine) return;
    _render(events || []);
}

export function suspendForHistorical() {
    _degradedReason = "historical_mode_disabled_v1";
    _unmount();
}

export function getStats() {
    const engineStats = _engine?.getStats?.() || {};
    return {
        active: _active,
        layers: engineStats.layerCount || 0,
        qualityTier: _quality?.currentTier?.() || "high",
        degradedReason: _degradedReason,
    };
}

function _mountIfNeeded() {
    if (_active || !_map) return;
    _overlay = createOverlay(_map, { zIndex: 470 });
    _engine = createEffectsEngine({ map: _map, app: _overlay.app });
    _mountTooltip(_overlay.host);
    _bindMapInteractions();
    _active = true;
    _degradedReason = null;
    _lastTs = 0;
    _raf = requestAnimationFrame(_tick);
}

function _unmount() {
    if (_raf) cancelAnimationFrame(_raf);
    _unbindMapInteractions();
    _setMapCursor(false);
    _hoveringEffect = false;
    _pinnedTarget = null;
    _clearTooltip();
    if (_tooltipEl?.parentNode) _tooltipEl.parentNode.removeChild(_tooltipEl);
    _tooltipEl = null;
    _raf = 0;
    _lastTs = 0;
    _engine?.destroy?.();
    _engine = null;
    _overlay?.destroy?.();
    _overlay = null;
    _active = false;
}

function _render(events) {
    if (!_engine) return;
    _engine.setEvents(events);
    if (_pinnedTarget) {
        const latest = _engine.getInteractionAt(_pinnedTarget.containerPoint);
        if (latest && latest.eventId === _pinnedTarget.eventId) {
            _showTooltip(latest, _pinnedTarget.containerPoint, true);
            _pinnedTarget = latest;
        } else {
            _pinnedTarget = null;
            _clearTooltip();
        }
    }
}

function _tick(ts) {
    if (!_active || !_engine) {
        _raf = 0;
        return;
    }
    const dt = Math.max(0.016, Math.min(0.05, (ts - (_lastTs || ts)) / 1000));
    _lastTs = ts;
    const t0 = performance.now();
    _engine.update(dt);
    _quality.pushFrameMs(performance.now() - t0);
    _raf = requestAnimationFrame(_tick);
}

function _bindMapInteractions() {
    if (!_map) return;
    _map.on("mousemove", _onMapMouseMove);
    _map.on("mouseout", _onMapMouseOut);
    _map.on("click", _onMapClick);
}

function _unbindMapInteractions() {
    if (!_map) return;
    _map.off("mousemove", _onMapMouseMove);
    _map.off("mouseout", _onMapMouseOut);
    _map.off("click", _onMapClick);
}

function _onMapMouseMove(e) {
    if (!_active || !_engine) return;
    if (_pinnedTarget) {
        _showTooltip(_pinnedTarget, e.containerPoint, true);
        return;
    }
    const hit = _engine.getInteractionAt(e.containerPoint);
    _hoveringEffect = !!hit;
    _setMapCursor(_hoveringEffect);
    if (hit) {
        _showTooltip(hit, e.containerPoint, false);
    } else {
        _clearTooltip();
    }
}

function _onMapMouseOut() {
    if (_pinnedTarget) return;
    _hoveringEffect = false;
    _setMapCursor(false);
    _clearTooltip();
}

function _onMapClick(e) {
    if (!_active || !_engine) return;
    const hit = _engine.getInteractionAt(e.containerPoint);
    if (!hit) {
        _pinnedTarget = null;
        _setMapCursor(false);
        _clearTooltip();
        return;
    }
    _pinnedTarget = hit;
    _showTooltip(hit, e.containerPoint, true);
    _ctx?.emit?.("map:regionClick", { eventId: hit.eventId });
}

function _mountTooltip(host) {
    if (!host || _tooltipEl) return;
    const tip = document.createElement("div");
    tip.className = "advanced-effects-tooltip";
    tip.style.display = "none";
    host.appendChild(tip);
    _tooltipEl = tip;
}

function _showTooltip(hit, containerPoint, pinned) {
    if (!_tooltipEl || !hit || !containerPoint) return;
    const summary = hit.summary ? `<div class="fx-tip-summary">${_escapeHtml(hit.summary)}</div>` : "";
    const pin = pinned ? `<span class="fx-tip-pin">Pinned</span>` : "";
    _tooltipEl.innerHTML = `
        <div class="fx-tip-title">${_escapeHtml(hit.title)} ${pin}</div>
        <div class="fx-tip-meta">${_escapeHtml(hit.effectType)} • ${_escapeHtml(hit.category)}</div>
        ${summary}
    `;
    _tooltipEl.style.display = "block";
    _tooltipEl.style.transform = `translate(${Math.round(containerPoint.x + 14)}px, ${Math.round(containerPoint.y - 18)}px)`;
}

function _clearTooltip() {
    if (!_tooltipEl) return;
    _tooltipEl.style.display = "none";
    _tooltipEl.innerHTML = "";
}

function _setMapCursor(pointer) {
    const el = _map?.getContainer?.();
    if (!el) return;
    el.style.cursor = pointer ? "pointer" : "";
}

function _escapeHtml(value) {
    const s = String(value ?? "");
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
