// ─── TIMELINE CONTROLLER — v4-app.js extraction ───────────────────────────────
// Owns: spine rendering, card build, focus/dim state, collapse, auto-hide.
// Receives: { state, ds, emit } context injected by orchestrator.
// Exports: init(ctx) → { renderTimeline, renderFocusState, prefetchRegions }
// ─────────────────────────────────────────────────────────────────────────────

import { formatCardTime } from "../services/time-processor.js";

// ── Internal cache ────────────────────────────────────────────────
const _regionCache = {};
let _geoData = null;

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

    const frag = document.createDocumentFragment();
    events.forEach(ev => {
        const card = _buildCard(ev);
        frag.appendChild(card);
    });
    spine.appendChild(frag);

    // Auto-scroll to the bottom (latest events) to give a "climbing down" effect
    requestAnimationFrame(() => {
        // Need brief timeout to allow DOM to calculate scrollHeight fully after cards insert
        setTimeout(() => {
            const scrollArea = document.getElementById("tl-scroll");
            if (scrollArea) {
                scrollArea.scrollTo({
                    top: scrollArea.scrollHeight,
                    behavior: 'smooth'
                });
            }
            // Add 'has-overflow' flag to cards with long summaries
            const wrappers = document.querySelectorAll(".tl-summary-wrap");
            wrappers.forEach(wrap => {
                const summaryEl = wrap.querySelector(".tl-summary");
                if (summaryEl && summaryEl.scrollHeight > summaryEl.clientHeight + 2) {
                    wrap.closest(".tl-card").classList.add("has-overflow");
                }
            });
        }, 100);
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

export function setGeoData(geoData) {
    _geoData = geoData;
}

/**
 * Time-machine filter: dim/hide events based on the scrubber position.
 * Events in the current bucket  → fully visible (highlighted)
 * Events before the bucket      → visible but dimmed (grey historical)
 * Events after the bucket       → hidden entirely
 */
export function applyHistoricalSnapshot(bucketIndex, timeBuckets, events) {
    const bucket = timeBuckets[bucketIndex];
    if (!bucket) return;

    const endTs = new Date(bucket.endTs);
    const startTs = bucket.startTs ? new Date(bucket.startTs) : null;

    const cards = document.querySelectorAll(".tl-card");
    cards.forEach(card => {
        const eventId = card.getAttribute("data-event-id");
        const ev = events.find(e => e.id === eventId);
        if (!ev) {
            card.classList.add("tl-hidden");
            return;
        }

        const evTs = new Date(ev.timestamp);

        if (evTs > endTs) {
            // Future event — hide entirely
            card.classList.add("tl-hidden");
            card.classList.remove("tl-historical-dim", "tl-current");
        } else if (startTs && evTs >= startTs) {
            // In current bucket — highlight
            card.classList.remove("tl-hidden", "tl-historical-dim");
            card.classList.add("tl-current");
        } else {
            // Past event — dim
            card.classList.remove("tl-hidden", "tl-current");
            card.classList.add("tl-historical-dim");
        }
    });
}

/** Remove all temporal visibility filters and return to default live appearance */
export function clearHistoricalSnapshot() {
    const cards = document.querySelectorAll(".tl-card");
    cards.forEach(card => {
        card.classList.remove("tl-hidden", "tl-historical-dim", "tl-current");
    });
}


// ═══════════════════════════════════════════════════════════════════
// PRIVATE — internal helpers
// ═══════════════════════════════════════════════════════════════════

function _buildCard(ev) {
    const catClass = `cat-${ev.category}`;
    const timeStr = formatCardTime(ev.timestamp);
    const regionLabel = _getRegionName(ev.regionId, ev.location?.block);

    // Get translated title and summary if available
    const currentLocale = _ctx.state.locale;
    let displayTitle = ev.title;
    let displaySummary = ev.summary;
    
    if (ev.translations && ev.translations[currentLocale]) {
        const translation = ev.translations[currentLocale];
        displayTitle = translation.title || ev.title;
        displaySummary = translation.summary || ev.summary;
    }

    const card = document.createElement("article");
    card.className = `tl-card ${catClass}`;
    card.setAttribute("data-event-id", ev.id);
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", displayTitle);

    card.innerHTML = `
    <div class="tl-card-inner">
      <div class="tl-card-head">
        <div class="tl-thumb" aria-hidden="true">${_buildThumb(ev.regionId)}</div>
        <div class="tl-meta">
          <div class="tl-loc-name">${regionLabel}</div>
          <div class="tl-time">${timeStr}</div>
        </div>
        <div class="tl-type-pill cat-pill-${ev.category}">${_catLabel(ev.category)}</div>
      </div>
      <div class="tl-title-row">${displayTitle}</div>
      <div class="tl-summary-wrap">
        <div class="tl-summary">${displaySummary}</div>
        <div class="tl-view-more" aria-hidden="true">View more</div>
      </div>
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
    if (_geoData && _geoData.features && window.d3 && regionId) {
        const feature = _geoData.features.find(f => {
            const id = f.properties?.id ?? f.id ?? "";
            return id === regionId;
        });

        if (feature) {
            const projection = d3.geoMercator().fitSize([28, 24], feature);
            const pathGen = d3.geoPath().projection(projection);
            const pathStr = pathGen(feature);

            return `<svg viewBox="0 0 28 24" xmlns="http://www.w3.org/2000/svg">
    <path d="${pathStr}" fill="var(--bg)" stroke="var(--rule)" stroke-width="1.2"/>
  </svg>`;
        }
    }

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

function _catLabel(cat) {
    const MAP = {
        health: "HEALTH",
        infrastructure: "INFRA",
        mobility: "MOBIL.",
        safety: "SAFETY",
        weather: "WEATHER",
        emergency: "EMRGNCY"
    };
    return MAP[cat] ?? cat.toUpperCase().slice(0, 7);
}

// ── Collapse ──────────────────────────────────────────────────────
function _initCollapse() {
    const panel = document.getElementById("timeline-panel");
    const tab = document.getElementById("tl-tab");
    const chevron = document.getElementById("tl-tab-chevron");

    const _updateChevron = () => {
        // ‹ = panel open, › = panel closed
        chevron.textContent = _ctx.state.manuallyCollapsed ? "›" : "‹";
        tab.setAttribute("aria-expanded", String(!_ctx.state.manuallyCollapsed));
    };

    const _expand = () => {
        _ctx.state.manuallyCollapsed = false;
        panel.classList.remove("hidden");
        _updateChevron();
        _ctx.emit("timeline:collapseChanged", { collapsed: false });
    };

    const toggle = () => {
        _ctx.state.manuallyCollapsed = !_ctx.state.manuallyCollapsed;
        panel.classList.toggle("hidden", _ctx.state.manuallyCollapsed);
        _updateChevron();
        _ctx.emit("timeline:collapseChanged", { collapsed: _ctx.state.manuallyCollapsed });
    };

    tab.addEventListener("click", toggle);
    tab.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") toggle(); });

    // Auto-expand when a card is clicked
    _initCardAutoExpand(_expand);
}

// ── Auto-expand on card tap ───────────────────────────────────────
function _initCardAutoExpand(expand) {
    // Watch for delegation on tl-scroll — cards are rendered later
    document.getElementById("tl-scroll")?.addEventListener("click", e => {
        if (e.target.closest(".tl-card") && _ctx.state.manuallyCollapsed) {
            expand();
        }
    });
}

// ── Blank spine tap → clear focus ────────────────────────────────
function _initSpineTap() {
    document.getElementById("tl-scroll")?.addEventListener("click", e => {
        if (!e.target.closest(".tl-card")) {
            _ctx.emit("timeline:cardTap", { eventId: null });
        }
    });
}
