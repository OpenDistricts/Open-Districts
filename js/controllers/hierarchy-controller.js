// ─── HIERARCHY CONTROLLER — v4-app.js extraction ──────────────────────────────
// Owns: Change Area overlay, tier-1 state grid, tier-2 district map + list.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { open, close }
// ─────────────────────────────────────────────────────────────────────────────

let _ctx;
let _allStates = [];
let _tierTwoState = null;

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

export function init(ctx) {
    _ctx = ctx;

    document.getElementById("tb-change-area").addEventListener("click", () => open());
    document.getElementById("hs-close").addEventListener("click", () => close());
    document.getElementById("hs-t2-close").addEventListener("click", () => close());
    document.getElementById("hs-back").addEventListener("click", () => _backToTier1());

    // Close on backdrop click
    document.getElementById("hierarchy-selector").addEventListener("click", e => {
        if (e.target === e.currentTarget) close();
    });

    // State search filter
    document.getElementById("hs-search").addEventListener("input", e => {
        const q = e.target.value.toLowerCase().trim();
        document.querySelectorAll(".state-cell").forEach(cell => {
            const name = cell.querySelector(".state-name").textContent.toLowerCase();
            cell.classList.toggle("hidden", q.length > 0 && !name.includes(q));
        });
    });
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC
// ═══════════════════════════════════════════════════════════════════

export async function open() {
    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.remove("hidden", "fading");

    // Reset to Tier 1
    document.getElementById("hs-tier1").style.display = "";
    document.getElementById("hs-tier2").classList.add("hidden");
    document.getElementById("hs-search").value = "";

    if (_allStates.length === 0) {
        _allStates = await _ctx.ds.getAllStates();
    }

    _renderStateGrid(_allStates);
}

export function close() {
    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.add("fading");
    setTimeout(() => overlay.classList.add("hidden"), 160);
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE
// ═══════════════════════════════════════════════════════════════════

function _renderStateGrid(states) {
    const grid = document.getElementById("hs-state-grid");
    grid.innerHTML = "";

    states.forEach(state => {
        const cell = document.createElement("div");
        cell.className = "state-cell" + (state.id === _ctx.state.currentStateId ? " active" : "");
        cell.setAttribute("role", "listitem");
        cell.setAttribute("tabindex", "0");
        cell.innerHTML = `
      <div class="state-name">${state.name}</div>
      ${state.activeAlertCount > 0
                ? `<div class="state-alert-badge"><div class="state-alert-dot"></div>${state.activeAlertCount} alerts</div>`
                : ""}`;
        cell.addEventListener("click", () => _loadTierTwo(state));
        cell.addEventListener("keydown", e => { if (e.key === "Enter") _loadTierTwo(state); });
        grid.appendChild(cell);
    });
}

async function _loadTierTwo(state) {
    _tierTwoState = state;
    document.getElementById("hs-tier1").style.display = "none";
    const tier2 = document.getElementById("hs-tier2");
    tier2.classList.remove("hidden");
    document.getElementById("hs-t2-state-name").textContent = state.name;

    const districts = await _ctx.ds.getDistrictsForState(state.id);
    let stateGeo = null;
    try {
        stateGeo = await _ctx.ds.getStateGeoJSON(state.id);
    } catch (e) {
        console.warn(`[Hierarchy] No GeoJSON found for state ${state.id}`, e);
    }

    _renderListMirror(districts);
    _renderSVGMap(districts, stateGeo);
}

function _renderListMirror(districts) {
    const list = document.getElementById("hs-district-list");
    list.innerHTML = "";

    districts.forEach(district => {
        const row = document.createElement("div");
        row.className = "dist-list-row" + (district.id === _ctx.state.currentDistrictId ? " active" : "");
        row.setAttribute("role", "listitem");
        row.setAttribute("tabindex", "0");
        row.innerHTML = `
      <span class="dist-list-name">${district.name}</span>
      ${district.activeAlertCount > 0
                ? `<span class="dist-list-alert">${district.activeAlertCount}</span>`
                : ""}`;
        row.addEventListener("click", () => _selectDistrict(district));
        row.addEventListener("keydown", e => { if (e.key === "Enter") _selectDistrict(district); });
        list.appendChild(row);
    });
}
function _renderSVGMap(districts, stateGeo) {
    const svg = document.getElementById("hs-district-svg");
    svg.innerHTML = "";

    const W = 400, H = 380;

    if (window.d3 && stateGeo && stateGeo.features && stateGeo.features.length > 0) {
        // Create projection mapped to SVG center
        const projection = d3.geoMercator().fitSize([W, H], stateGeo);
        const pathGen = d3.geoPath().projection(projection);

        // Draw ALL features from the GeoJSON to form the complete state map
        stateGeo.features.forEach(feature => {
            const name = feature.properties.NAME_2 || feature.properties.dtname || "";
            const pathStr = pathGen(feature);
            const centroid = pathGen.centroid(feature);

            // Does this geo feature map to one of our active mock districts?
            const matchedDistrict = districts.find(d => name.toLowerCase().includes(d.name.toLowerCase()));

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathStr);
            path.classList.add("hdist-poly");

            if (matchedDistrict) {
                if (matchedDistrict.id === _ctx.state.currentDistrictId) path.classList.add("active");
                path.addEventListener("click", () => _selectDistrict(matchedDistrict));

                // District name
                let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", centroid[0]);
                text.setAttribute("y", centroid[1]);
                text.setAttribute("text-anchor", "middle");
                text.classList.add("hdist-lbl");
                if (matchedDistrict.id === _ctx.state.currentDistrictId) text.classList.add("active");
                text.textContent = matchedDistrict.name;
                text.setAttribute("pointer-events", "none");
                svg.appendChild(text);

                // Alert dot (dynamically offsetting from center)
                if (matchedDistrict.activeAlertCount > 0) {
                    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    dot.setAttribute("cx", centroid[0] + 15);
                    dot.setAttribute("cy", centroid[1] - 15);
                    dot.setAttribute("r", "4");
                    dot.classList.add("hdist-alert-dot");
                    dot.setAttribute("pointer-events", "none");
                    svg.appendChild(dot);
                }
            } else {
                path.style.opacity = "0.2"; // Dim districts we have no mock data for
            }

            // Append path before text/dots so they layer on top
            svg.insertBefore(path, svg.firstChild);
        });
        return;
    }

    // GRID FALLBACK
    const cols = Math.ceil(Math.sqrt(districts.length));
    const rows = Math.ceil(districts.length / cols);
    const cellW = W / cols;
    const cellH = H / rows;
    const PAD = 0.1;

    districts.forEach((district, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellW + cellW * PAD;
        const y = row * cellH + cellH * PAD;
        const w = cellW * (1 - PAD * 2);
        const h = cellH * (1 - PAD * 2);

        // Polygon (rect as proxy for real shapefile)
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x); rect.setAttribute("y", y);
        rect.setAttribute("width", w); rect.setAttribute("height", h);
        rect.setAttribute("rx", "3");
        rect.classList.add("dist-poly"); // old class
        if (district.id === _ctx.state.currentDistrictId) rect.classList.add("active");
        rect.addEventListener("click", () => _selectDistrict(district));
        svg.appendChild(rect);

        // District name — centered within cell
        const textFallback = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textFallback.setAttribute("x", x + w / 2);
        textFallback.setAttribute("y", y + h / 2 - 4);
        textFallback.setAttribute("text-anchor", "middle");
        textFallback.setAttribute("font-size", Math.min(10, Math.floor(cellH * 0.22)));
        textFallback.setAttribute("font-family", "DM Mono, monospace");
        textFallback.setAttribute("fill", "rgba(255,255,255,0.85)");
        textFallback.setAttribute("pointer-events", "none");
        textFallback.textContent = district.name;
        svg.appendChild(textFallback);

        // Alert dot (top-right corner)
        if (district.activeAlertCount > 0) {
            const dotFallback = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dotFallback.setAttribute("cx", x + w - 7); dotFallback.setAttribute("cy", y + 7);
            dotFallback.setAttribute("r", "4.5");
            dotFallback.classList.add("dist-alert-dot");
            dotFallback.setAttribute("pointer-events", "none");
            svg.appendChild(dotFallback);
        }
    });
}

function _selectDistrict(district) {
    close();
    // Emit district change — orchestrator owns the data reload
    _ctx.emit("hierarchy:districtSelected", { districtId: district.id, stateId: district.stateId });
}

function _backToTier1() {
    document.getElementById("hs-tier2").classList.add("hidden");
    document.getElementById("hs-tier1").style.display = "";
}
