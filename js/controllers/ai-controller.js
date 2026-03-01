// ─── AI CONTROLLER — v4-app.js extraction ─────────────────────────────────────
// Owns: AI panel open/close, context mode switching, intent → result rendering.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { open, close }
// ─────────────────────────────────────────────────────────────────────────────

import { formatCardTime } from "../services/time-processor.js";

let _ctx;

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

export function init(ctx) {
    _ctx = ctx;

    // ai-tab (side tab, always visible) — symmetric toggle
    const aiTab = document.getElementById("ai-tab");
    const aiChevron = document.getElementById("ai-tab-chevron");

    const _updateChevron = (isOpen) => {
        // › = closed (tap to open), ‹ = open (tap to close)
        aiChevron.textContent = isOpen ? "›" : "‹";
        aiTab.setAttribute("aria-expanded", String(isOpen));
    };

    aiTab.addEventListener("click", () => {
        const panel = document.getElementById("ai-panel");
        panel.classList.contains("open") ? _close() : _open();
        _updateChevron(!document.getElementById("ai-panel").classList.contains("open"));
    });
    aiTab.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") aiTab.click();
    });

    // GUIDED AI topbar button — always opens (panel not visible when topbar is accessible)
    document.getElementById("tb-ai-btn").addEventListener("click", () => _open());

    // Close button in panel header
    document.getElementById("ai-close-btn").addEventListener("click", () => {
        _close();
        _updateChevron(false);
    });

    document.querySelectorAll(".intent-card").forEach(card => {
        card.addEventListener("click", () => _showResult(card.getAttribute("data-intent")));
    });
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC
// ═══════════════════════════════════════════════════════════════════

export function open() { _open(); }
export function close() { _close(); }

/** Clear result area (called by orchestrator when district changes). */
export function reset() {
    document.getElementById("ai-result").classList.add("hidden");
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE
// ═══════════════════════════════════════════════════════════════════

function _open() {
    const panel = document.getElementById("ai-panel");
    const contextBar = document.getElementById("ai-context-bar");
    const contextText = document.getElementById("ai-context-text");
    const genIntents = document.getElementById("ai-intents-general");
    const evtIntents = document.getElementById("ai-intents-event");
    const contextMode = document.getElementById("ai-context-mode-badge");

    // One-time snapshot at moment of button press (Section 09)
    const focusedId = _ctx.state.focusedEventId;
    const focusedEvent = focusedId
        ? (_ctx.state.events ?? []).find(e => e.id === focusedId)
        : null;

    // Clear old result
    document.getElementById("ai-result").classList.add("hidden");

    if (focusedEvent) {
        // ── EVENT-BOUND context ──────────────────────────────────────
        contextBar.className = "event-bound";
        const timeStr = formatCardTime(focusedEvent.timestamp);
        const regionLabel = _humaniseRegion(focusedEvent.regionId) ?? focusedEvent.location?.block ?? "–";
        contextText.textContent = `${focusedEvent.category.toUpperCase()} · ${regionLabel} · ${timeStr}`;
        if (contextMode) {
            contextMode.textContent = "EVENT CONTEXT";
            contextMode.className = "ai-context-badge event";
        }
        genIntents.classList.add("hidden");
        evtIntents.classList.remove("hidden");
    } else {
        // ── GENERAL DISTRICT context ─────────────────────────────────
        contextBar.className = "general";
        const districtName = _ctx.state.currentDistrict?.name ?? "–";
        contextText.textContent = `DISTRICT · ${districtName} · GENERAL`;
        if (contextMode) {
            contextMode.textContent = "DISTRICT CONTEXT";
            contextMode.className = "ai-context-badge general";
        }
        genIntents.classList.remove("hidden");
        evtIntents.classList.add("hidden");
    }

    panel.classList.add("open");
}

function _close() {
    document.getElementById("ai-panel").classList.remove("open");
}

function _showResult(intent) {
    const RESULTS = {
        "disease-history": {
            source: "ICMR historical data · Khordha, 2022–2025",
            body: "Khordha district reports seasonal fever clusters in Feb–Apr for 3 consecutive years. Balianta Block has the highest incidence at 4.2 per 1,000 population. Waterborne illness peaks align with post-harvest groundwater depletion."
        },
        "nearest-facility": {
            source: "Odisha Health GIS · Last updated 26-Feb-2025",
            body: "3 PHCs within 10km operational. Nearest: Balianta PHC (2.3km, 24×7 emergency). Tangi CHC (7.1km, 30 beds). Khordha District Hospital (9.4km, specialist care)."
        },
        "water-status": {
            source: "Odisha Jal Mission · Real-time status",
            body: "14 of 17 borewells operational in Khordha block. Borewell #7 Tangi non-operational (repair in progress). Tanker supply to 1,200 residents arranged."
        },
        "safe-travel": {
            source: "NHAI / Odisha PWD · Current advisories",
            body: "NH-16 diversion in effect near Bhubaneswar junction. SH-12 all-clear. No emergency vehicle restriction active. Road condition: Good on primary roads, Fair on Bolagarh block rural links."
        },
        "spreading": {
            source: "State Surveillance Unit · 7-day trend",
            body: "7-day trajectory: peak Day 3 (23 cases), plateau Days 5–7 (18 cases), early decline visible. No spread to adjacent blocks detected. PHC contact tracing ongoing."
        },
        "historical-compare": {
            source: "ICMR / State Health · 2022–2024 archive",
            body: "Same event type reported in Balianta Block in Feb 2023 (31 cases) and Feb 2024 (19 cases). Current outbreak (23 cases) within historical range. Mobile team response time improved from 18h (2023) to 6h (2025)."
        },
    };

    const result = RESULTS[intent] ?? {
        source: "OpenDistricts knowledge base",
        body: "Data for this query is not available in the current district context."
    };

    document.getElementById("ai-result-source-text").textContent = result.source;
    document.getElementById("ai-result-body").textContent = result.body;
    document.getElementById("ai-result").classList.remove("hidden");
}

function _humaniseRegion(regionId) {
    if (!regionId) return null;
    return regionId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
