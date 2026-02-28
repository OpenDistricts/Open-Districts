// ─── TIMELINE CONTROLLER — v4-app.js extraction ───────────────────────────────
// Owns: spine rendering, card build, focus/dim state, collapse, auto-hide.
// Receives: { state, ds, emit } context injected by orchestrator.
// Exports: init(ctx) → { renderTimeline, renderFocusState, prefetchRegions }
// ─────────────────────────────────────────────────────────────────────────────

import { formatCardTime } from "../services/time-processor.js";

// ── Internal cache ────────────────────────────────────────────────
const _regionCache = {};

// ── Module-level context ref (set at init) ────────────────────────
let _ctx;

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

export function init(ctx) {
    _ctx = ctx;
    _initCollapse();
    _initSpineTap();
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC — called by orchestrator
// ═══════════════════════════════════════════════════════════════════

/** Rebuild the spine from scratch with a new event array. */
export function renderTimeline(events) {
    const spine = document.getElementById("tl-spine");
    if (!spine) return;
    spine.innerHTML = "";

    if (!events || events.length === 0) {
        spine.innerHTML = `<div class="tl-empty-state">No events in this district</div>`;
        return;
    }

    events.forEach(ev => {
        const card = _buildCard(ev);
        spine.appendChild(card);
    });
}

/** Apply focus/dimmed classes to all cards. Side-effect free from AppState. */
export function renderFocusState(focusedEventId) {
    const cards = document.querySelectorAll(".tl-card");

    if (!focusedEventId) {
        cards.forEach(c => c.classList.remove("focused", "dimmed"));
        return;
    }

    cards.forEach(card => {
        const id = card.getAttribute("data-event-id");
        if (id === focusedEventId) {
            card.classList.add("focused");
            card.classList.remove("dimmed");
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            card.classList.add("dimmed");
            card.classList.remove("focused");
        }
    });
}

/** Update the district name label in the panel header. */
export function renderPanelHeader(districtName) {
    const el = document.getElementById("tl-header-district");
    if (el) el.textContent = districtName;
}

/** Pre-populate region name cache from DataService. */
export async function prefetchRegions(districtId) {
    const regions = await _ctx.ds.getRegionsForDistrict(districtId);
    regions.forEach(r => { _regionCache[r.id] = r; });
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE — internal helpers
// ═══════════════════════════════════════════════════════════════════

function _buildCard(ev) {
    const sevClass = ev.severity === "informational" ? "sev-info" : `sev-${ev.severity}`;
    const timeStr = formatCardTime(ev.timestamp);
    const regionLabel = _getRegionName(ev.regionId, ev.location?.block);

    const card = document.createElement("article");
    card.className = `tl-card ${sevClass}`;
    card.setAttribute("data-event-id", ev.id);
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", ev.title);

    card.innerHTML = `
    <div class="tl-card-inner">
      <div class="tl-card-head">
        <div class="tl-thumb" aria-hidden="true">${_buildThumb(ev.regionId)}</div>
        <div class="tl-meta">
          <div class="tl-loc-name">${regionLabel}</div>
          <div class="tl-time">${timeStr}</div>
        </div>
        <div class="tl-severity-pill sev-pill-${sevClass}">${_sevLabel(ev.severity)}</div>
      </div>
      <div class="tl-title-row">${ev.title}</div>
      <div class="tl-summary">${ev.summary}</div>
      <div class="tl-details">
        ${_buildDetailRows(ev)}
        <div class="tl-source-tag">
          <div class="tl-source-dot" aria-hidden="true"></div>
          ${ev.verified ? "Verified" : "Unverified"} &middot; ${ev.source}
        </div>
      </div>
    </div>`;

    card.addEventListener("click", () => {
        // Emit to orchestrator — it owns state mutation
        const currentFocused = _ctx.state.focusedEventId;
        _ctx.emit("timeline:cardTap", { eventId: currentFocused === ev.id ? null : ev.id });
    });

    return card;
}

function _buildDetailRows(ev) {
    const rows = [];
    const m = ev.meta ?? {};
    if (m.caseCount !== undefined) rows.push(["CASES", m.caseCount]);
    if (m.phcName) rows.push(["FACILITY", m.phcName]);
    if (m.affectedPopulation) rows.push(["AFFECTED", m.affectedPopulation.toLocaleString()]);
    if (m.highway) rows.push(["HIGHWAY", m.highway]);
    if (m.zone) rows.push(["ZONE", m.zone]);
    if (m.actionsTaken?.length) rows.push(["ACTION", m.actionsTaken[0]]);
    return rows.map(([label, value]) =>
        `<div class="tl-detail-row">
       <div class="tl-detail-label">${label}</div>
       <div class="tl-detail-value">${value}</div>
     </div>`).join("");
}

function _buildThumb(regionId) {
    const hash = regionId ? regionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) : 42;
    const cx = 14, cy = 12, sides = 5 + (hash % 3);
    const pts = [];
    for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const r = 8 + (hash * (i + 1) % 4);
        pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
    }
    return `<svg viewBox="0 0 28 24" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${pts.join(" ")}" fill="var(--bg)" stroke="var(--rule)" stroke-width="1.2"/>
  </svg>`;
}

function _getRegionName(regionId, fallback) {
    if (!regionId) return fallback ?? "–";
    const cached = _regionCache[regionId];
    if (cached) return cached.name;
    // Humanise the kebab-case regionId
    return regionId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function _sevLabel(s) {
    return { critical: "CRIT", elevated: "ELEV", informational: "INFO", clear: "CLEAR" }[s] ?? s.toUpperCase();
}

// ── Collapse ──────────────────────────────────────────────────────
function _initCollapse() {
    const panel = document.getElementById("timeline-panel");
    const topBarBtn = document.getElementById("tb-timeline-btn");
    const inPanelBtn = document.getElementById("tl-collapse-btn");

    const open = () => {
        _ctx.state.manuallyCollapsed = false;
        panel.classList.remove("hidden");
        topBarBtn?.setAttribute("aria-expanded", "true");
        inPanelBtn?.setAttribute("aria-expanded", "true");
        _ctx.emit("timeline:collapseChanged", { collapsed: false });
    };

    const close = () => {
        _ctx.state.manuallyCollapsed = true;
        panel.classList.add("hidden");
        topBarBtn?.setAttribute("aria-expanded", "false");
        inPanelBtn?.setAttribute("aria-expanded", "false");
        _ctx.emit("timeline:collapseChanged", { collapsed: true });
    };

    // Top-bar button: always visible — symmetric toggle
    topBarBtn?.addEventListener("click", () => {
        _ctx.state.manuallyCollapsed ? open() : close();
    });

    // In-panel header button: acts as close-only (panel visible when this is reachable)
    inPanelBtn?.addEventListener("click", close);
}


// ── Blank spine tap → clear focus ────────────────────────────────
function _initSpineTap() {
    document.getElementById("tl-scroll")?.addEventListener("click", e => {
        if (!e.target.closest(".tl-card")) {
            _ctx.emit("timeline:cardTap", { eventId: null });
        }
    });
}
