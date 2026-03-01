// ─── HIERARCHY CONTROLLER — v4-app.js extraction ──────────────────────────────
// Owns: Change Area overlay, tier-1 state grid, tier-2 district map + list.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { open, close }
// ─────────────────────────────────────────────────────────────────────────────
import { fuzzyMatch } from '../utils/string-matcher.js';

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
        document.querySelectorAll(".india-state-path").forEach(path => {
            const name = path.getAttribute("data-state-name").toLowerCase();
            const label = document.getElementById(`lbl-${path.getAttribute("data-state-id")}`);

            if (q.length === 0) {
                path.classList.remove("search-match", "search-dim");
                if (label) label.style.opacity = "";
            } else if (name.includes(q)) {
                path.classList.add("search-match");
                path.classList.remove("search-dim");
                if (label) label.style.opacity = "1";
            } else {
                path.classList.remove("search-match");
                path.classList.add("search-dim");
                if (label) label.style.opacity = "0.1";
            }
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
    document.getElementById("hs-state-stats-bar").classList.add("hidden");

    if (_allStates.length === 0) {
        _allStates = await _ctx.ds.getAllStates();
    }

    _renderIndiaMinimap(_allStates);
}

/**
 * Jump directly to the Tier 2 (district map) for a known stateId.
 * Used by the boot sequence after geolocation detects the user's state.
 * @param {string} stateId  e.g. "OD", "MH"
 */
export async function openState(stateId) {
    if (_allStates.length === 0) {
        _allStates = await _ctx.ds.getAllStates();
    }

    const state = _allStates.find(s => s.id === stateId);
    if (!state) {
        console.warn(`[Hierarchy] openState: unknown state '${stateId}', falling back to India view.`);
        return open(); // graceful fallback
    }

    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.remove("hidden", "fading");

    // Reset UI state, then immediately go to Tier 2
    document.getElementById("hs-state-stats-bar").classList.add("hidden");
    document.getElementById("hs-search").value = "";

    await _loadTierTwo(state);
}

export function close() {
    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.add("fading");
    setTimeout(() => overlay.classList.add("hidden"), 160);
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE
// ═══════════════════════════════════════════════════════════════════

// Scoped variable for single vs double click tracking
let _stateClickTimer = null;
let _lastClickedStateId = null;

async function _renderIndiaMinimap(states) {
    const svg = document.getElementById("hs-india-svg");
    if (svg.children.length > 0) return; // avoid re-rendering entire D3 map if already done

    // Clear once and load geojson
    svg.innerHTML = "";
    const geoData = await _ctx.ds.getAllStatesGeoJSON();
    if (!geoData || !geoData.features || !window.d3) return;

    const W = 800, H = 800;
    const projection = d3.geoMercator().fitSize([W, H], geoData);
    const pathGen = d3.geoPath().projection(projection);

    geoData.features.forEach(feature => {
        const geoName = feature.properties.name || "";
        const matchedState = states.find(s => s.name.toLowerCase() === geoName.toLowerCase());

        // Use the proper state ID if matched, otherwise fallback to the geojson's string
        const stateId = matchedState ? matchedState.id : (feature.properties.id || geoName.replace(/\s+/g, '-'));

        const pathStr = pathGen(feature);
        const centroid = pathGen.centroid(feature);
        const bounds = pathGen.bounds(feature);
        const width = bounds[1][0] - bounds[0][0];

        // Path
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathStr);
        path.classList.add("india-state-path");
        path.setAttribute("data-state-id", stateId);
        path.setAttribute("data-state-name", geoName);

        // A state is unsupported if we have no events for it
        const isSupported = matchedState && matchedState.dataPoints > 0;
        if (!isSupported) {
            path.classList.add("unsupported"); // Mark no-data states
        } else {
            // Mouse interactions for glow
            path.addEventListener("mouseenter", () => {
                path.classList.add("hovered");
                const lbl = document.getElementById(`lbl-${stateId}`);
                if (lbl) lbl.classList.add("active");
            });
            path.addEventListener("mouseleave", () => {
                path.classList.remove("hovered");
                const lbl = document.getElementById(`lbl-${stateId}`);
                if (lbl) lbl.classList.remove("active");
            });
        }

        // Click logic
        path.addEventListener("click", () => {
            if (_lastClickedStateId === stateId) {
                // Double click
                clearTimeout(_stateClickTimer);
                _lastClickedStateId = null;
                if (matchedState) _loadTierTwo(matchedState);
            } else {
                // Single click
                _lastClickedStateId = stateId;

                // Active styles
                svg.querySelectorAll('.india-state-path').forEach(p => p.classList.remove('selected'));
                svg.querySelectorAll('.state-label').forEach(l => l.classList.remove('active'));

                path.classList.add('selected');
                const lbl = document.getElementById(`lbl-${stateId}`);
                if (lbl) lbl.classList.add("active");

                if (matchedState) _showStateStats(matchedState);

                clearTimeout(_stateClickTimer);
                _stateClickTimer = setTimeout(() => {
                    _lastClickedStateId = null;
                }, 400); // 400ms tolerance
            }
        });

        svg.appendChild(path);

        // Label — Skip drawing text if the state's projected width is too small (avoids Northeast overlapping)
        if (geoName && centroid && !isNaN(centroid[0]) && !isNaN(centroid[1]) && width > 25) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", centroid[0]);
            text.setAttribute("y", centroid[1]);
            text.id = `lbl-${stateId}`;
            text.classList.add("state-label");
            text.textContent = geoName;
            text.style.pointerEvents = "none"; // Make sure labels don't intercept hover
            svg.appendChild(text);
        }
    });
}

function _showStateStats(state) {
    const bar = document.getElementById("hs-state-stats-bar");
    bar.classList.remove("hidden");

    // reset transition
    bar.style.transition = 'none';
    bar.classList.add("slide-out");
    void bar.offsetWidth; // flush CSS
    bar.style.transition = '';
    bar.classList.remove("slide-out");

    document.getElementById("hs-state-stats-name").textContent = state.name;
    const alertsEl = document.getElementById("hs-state-stats-alerts");
    const popEl = document.getElementById("hs-state-stats-pop");

    const hasData = state.districts && state.districts.length > 0;

    if (hasData) {
        popEl.textContent = Math.floor(100 + (state.name.length * 15)) + " Lakh";
        alertsEl.textContent = state.dataPoints || 0;
        if (!state.dataPoints || state.dataPoints === 0) {
            alertsEl.classList.remove("danger-text");
            alertsEl.style.color = "var(--ok)";
        } else {
            alertsEl.classList.add("danger-text");
            alertsEl.style.color = "";
        }
    } else {
        popEl.textContent = "Data Not Found";
        alertsEl.textContent = "No Data";
        alertsEl.classList.remove("danger-text");
        alertsEl.style.color = "rgba(255,255,255,0.4)";
    }

    // Setup button for explicit navigation
    const actionContainer = document.getElementById("hs-state-stats-action");
    // clear and append to ensure fresh binding
    actionContainer.innerHTML = `
        <button id="hs-stats-enter-state-btn" class="hs-enter-btn">View Districts</button>
    `;
    document.getElementById("hs-stats-enter-state-btn").onclick = () => {
        _loadTierTwo(state);
    };
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

    _renderSVGMap(districts, stateGeo);
}

function _renderSVGMap(districts, stateGeo) {
    const svg = document.getElementById("hs-district-svg");
    svg.innerHTML = "";

    // Hide stats initially on fresh render
    const statsPanel = document.getElementById("hs-district-stats");
    statsPanel.classList.remove("open");

    const W = 400, H = 380;

    // Scoped state for handling single vs double clicks
    let clickTimer = null;
    let lastClickedId = null;

    if (window.d3 && stateGeo && stateGeo.features && stateGeo.features.length > 0) {
        // Create projection mapped to SVG center
        const projection = d3.geoMercator().fitSize([W, H], stateGeo);
        const pathGen = d3.geoPath().projection(projection);

        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

        // Draw ALL features from the GeoJSON to form the complete state map
        stateGeo.features.forEach(feature => {
            const name = feature.properties.name || feature.properties.NAME_2 || feature.properties.dtname || "";
            const pathStr = pathGen(feature);
            const centroid = pathGen.centroid(feature);

            // Resilient matching tying 2011 census properties to live metadata aliases using Levenshtein distance
            const matchedDistrict = districts.find(d => {
                const candidates = [d.name, ...(d.aliases || [])];
                return fuzzyMatch(name, candidates, 2) !== null;
            });

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathStr);
            path.classList.add("hdist-poly");

            if (matchedDistrict) {
                if (matchedDistrict.id === _ctx.state.currentDistrictId) path.classList.add("active");

                // District name label
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", centroid[0]);
                text.setAttribute("y", centroid[1]);
                text.setAttribute("text-anchor", "middle");
                text.classList.add("hdist-lbl");
                if (matchedDistrict.id === _ctx.state.currentDistrictId) text.classList.add("active");
                text.textContent = matchedDistrict.name;
                text.setAttribute("pointer-events", "none");
                svg.appendChild(text);

                // Data point dot
                if (matchedDistrict.dataPoints > 0) {
                    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    dot.setAttribute("cx", centroid[0] + 15);
                    dot.setAttribute("cy", centroid[1] - 15);
                    dot.setAttribute("r", "4");
                    dot.classList.add("hdist-alert-dot");
                    dot.setAttribute("pointer-events", "none");
                    svg.appendChild(dot);
                }

                // Double click handler
                path.addEventListener("click", () => {
                    if (lastClickedId === matchedDistrict.id) {
                        clearTimeout(clickTimer);
                        lastClickedId = null;
                        _selectDistrict(matchedDistrict);
                    } else {
                        lastClickedId = matchedDistrict.id;
                        svg.querySelectorAll('.hdist-poly').forEach(p => p.classList.remove('active'));
                        svg.querySelectorAll('.hdist-lbl').forEach(l => l.classList.remove('active'));
                        path.classList.add('active');
                        text.classList.add('active');
                        _showStatsPanel(matchedDistrict);
                        clearTimeout(clickTimer);
                        clickTimer = setTimeout(() => { lastClickedId = null; }, 400);
                    }
                });
            } else {
                // Unmatched district: render dimly so the full state map is visible
                path.classList.add("unsupported");
                path.style.opacity = "0.35";
                path.style.cursor = "default";

                // Still show its name as a very dim label
                if (name && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
                    const dimLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    dimLabel.setAttribute("x", centroid[0]);
                    dimLabel.setAttribute("y", centroid[1]);
                    dimLabel.setAttribute("text-anchor", "middle");
                    dimLabel.setAttribute("font-size", "7");
                    dimLabel.setAttribute("font-family", "DM Mono, monospace");
                    dimLabel.setAttribute("fill", "rgba(255,255,255,0.28)");
                    dimLabel.setAttribute("pointer-events", "none");
                    dimLabel.textContent = name;
                    svg.appendChild(dimLabel);
                }
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

        // Interaction logic mapping identical to D3 double click
        rect.addEventListener("click", () => {
            if (lastClickedId === district.id) {
                clearTimeout(clickTimer);
                lastClickedId = null;
                _selectDistrict(district);
            } else {
                lastClickedId = district.id;

                svg.querySelectorAll('.dist-poly').forEach(p => p.classList.remove('active'));
                rect.classList.add('active');

                // We dont have real SVG path strings here, fallback panel shape rendering
                _showStatsPanel(district, null);

                clearTimeout(clickTimer);
                clickTimer = setTimeout(() => {
                    lastClickedId = null;
                }, 400);
            }
        });

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
        if (district.dataPoints > 0) {
            const dotFallback = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dotFallback.setAttribute("cx", x + w - 7); dotFallback.setAttribute("cy", y + 7);
            dotFallback.setAttribute("r", "4.5");
            dotFallback.classList.add("dist-alert-dot");
            dotFallback.setAttribute("pointer-events", "none");
            svg.appendChild(dotFallback);
        }
    });
}

function _showStatsPanel(district) {
    const statsPanel = document.getElementById("hs-district-stats");
    const nameEl = document.getElementById("hs-stats-name");
    const popEl = document.getElementById("hs-stats-pop");
    const alertsEl = document.getElementById("hs-stats-alerts");
    const actionEl = document.getElementById("hs-stats-action");

    // Enable CSS transition slide-push
    statsPanel.classList.add("open");

    // Populate data
    nameEl.textContent = district.name;
    // Generate pseudo-population based on name string length for demo realism
    popEl.textContent = Math.floor(10 + (district.name.length * 2.3)) + " Lakh";

    if (!district.dataPoints || district.dataPoints === 0) {
        alertsEl.textContent = "No Data";
        alertsEl.classList.remove("danger-text");
        alertsEl.style.color = "rgba(255,255,255,0.4)";
    } else {
        alertsEl.textContent = district.dataPoints;
        alertsEl.classList.add("danger-text");
        alertsEl.style.color = "";
    }

    // Inject "View Map" button — also bound to same _selectDistrict action
    actionEl.innerHTML = `<button class="hs-district-action-btn">View Map</button>`;
    actionEl.querySelector("button").onclick = () => _selectDistrict(district);
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
