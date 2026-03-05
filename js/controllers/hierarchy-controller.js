// ─── HIERARCHY CONTROLLER — v4-app.js extraction ──────────────────────────────
// Owns: Change Area overlay, tier-1 state grid, tier-2 district map + list.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { open, close, updateLabels }
// ─────────────────────────────────────────────────────────────────────────────
import { fuzzyMatch } from '../utils/string-matcher.js';
import { t } from "../v4-app.js";

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
    document.getElementById("hs-panel-close")?.addEventListener("click", () => _collapseTierOnePanel());
    document.getElementById("hs-panel-open")?.addEventListener("click", () => _expandTierOnePanel());

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
            } else if (name.startsWith(q)) {
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

    // District search filter (Tier 2)
    document.getElementById("hs-t2-search").addEventListener("input", e => {
        const q = e.target.value.toLowerCase().trim();
        document.querySelectorAll(".hdist-poly").forEach(path => {
            const dname = path.getAttribute("data-district-name") || "";
            const lbl = document.querySelector(`.hdist-lbl[data-district-name="${dname}"]`);
            if (q.length === 0) {
                path.classList.remove("search-match", "search-dim");
                if (lbl) { lbl.classList.remove("search-dim"); lbl.style.opacity = ""; }
            } else if (dname.startsWith(q)) {
                path.classList.add("search-match");
                path.classList.remove("search-dim");
                if (lbl) { lbl.classList.remove("search-dim"); lbl.style.opacity = "1"; }
            } else {
                path.classList.remove("search-match");
                path.classList.add("search-dim");
                if (lbl) { lbl.classList.add("search-dim"); lbl.style.opacity = "0.15"; }
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
    _expandTierOnePanel();

    // Always refetch states with current timeline range to stay in sync
    _allStates = await _ctx.ds.getAllStates(_ctx.state.timelineRange);

    _renderIndiaMinimap(_allStates);
    _ctx.emit("hierarchy:opened");
}

/**
 * Jump directly to the Tier 2 (district map) for a known stateId.
 * Used by the boot sequence after geolocation detects the user's state.
 * @param {string} stateId  e.g. "OD", "MH"
 */
export async function openState(stateId) {
    // Always refetch states with current timeline range to stay in sync
    _allStates = await _ctx.ds.getAllStates(_ctx.state.timelineRange);

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
    _expandTierOnePanel();

    _renderIndiaMinimap(_allStates);
    await _loadTierTwo(state);
    _ctx.emit("hierarchy:opened");
}

export function close() {
    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.add("fading");
    setTimeout(() => {
        overlay.classList.add("hidden");
        _ctx.emit("hierarchy:closed");
    }, 160);
}

/**
 * Update labels when language changes.
 */
export function updateLabels() {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    const search = document.getElementById("hs-search");
    if (search) {
        search.setAttribute("placeholder", t("ui.searchState"));
        search.setAttribute("aria-label", t("ui.searchState"));
    }

    setText("hs-title", t("ui.selectState"));
    setText("hs-popup-title", t("ui.stateSelector"));
    setText("hs-panel-open", t("ui.statePanel"));
    setText("hs-state-pop-label", t("ui.population"));
    setText("hs-state-points-label", t("ui.dataPoints"));
    setText("hs-dist-pop-label", t("ui.population"));
    setText("hs-dist-points-label", t("ui.dataPoints"));
    setText("hs-state-stats-action", t("ui.doubleClickEnter"));

    const enterBtn = document.getElementById("hs-stats-enter-state-btn");
    if (enterBtn) enterBtn.textContent = t("ui.viewDistricts");

    const viewMapBtn = document.querySelector("#hs-stats-action .hs-district-action-btn");
    if (viewMapBtn) viewMapBtn.textContent = t("ui.viewMap");
}

/**
 * Refresh hierarchy counts based on a new time range.
 * Called when timeline is scrubbed so that hierarchy selector
 * shows event counts for only the visible (filtered) events.
 * 
 * @param {Object} timelineRange - { from?: ISO string, to?: ISO string } or null for live
 */
export async function syncWithTimeline(timelineRange) {
    if (!_allStates || _allStates.length === 0) return;

    // Refetch state data with the new date range
    _allStates = await _ctx.ds.getAllStates(timelineRange);

    // Check if hierarchy selector is currently visible
    const overlay = document.getElementById("hierarchy-selector");
    if (!overlay || overlay.classList.contains("hidden")) return;

    // If Tier 1 is showing, re-render the minimap (it will use updated _allStates)
    const tier1 = document.getElementById("hs-tier1");
    const tier2 = document.getElementById("hs-tier2");

    if (tier1 && tier1.style.display !== "none") {
        // Re-render the minimap with updated counts
        const svg = document.getElementById("hs-india-svg");
        svg.innerHTML = "";
        _renderIndiaMinimap(_allStates);
    }

    // If Tier 2 is showing, refresh districts for the selected state
    if (tier2 && !tier2.classList.contains("hidden") && _tierTwoState) {
        const updatedState = _allStates.find(s => s.id === _tierTwoState.id);
        if (updatedState) {
            _tierTwoState = updatedState;
            
            // Refetch districts with the new time range to get updated dataPoints
            const districts = await _ctx.ds.getDistrictsForState(_tierTwoState.id, timelineRange);
            let stateGeo = null;
            try {
                stateGeo = await _ctx.ds.getStateGeoJSON(_tierTwoState.id);
            } catch (e) {
                console.warn(`[Hierarchy] No GeoJSON found for state ${_tierTwoState.id}`, e);
            }
            
            // Re-render the district map with updated dataPoints
            _renderSVGMap(districts, stateGeo);

            // Update state stats if visible
            if (!document.getElementById("hs-state-stats-bar")?.classList.contains("hidden")) {
                _showStateStats(_tierTwoState);
            }
        }
    }
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
        const geoName = feature.properties.name || feature.properties.NAME_1 || "";
        // Some old dataset IDs are named HARY, etc., which fallback to old ID map
        const fallbackIds = { 'HARY': 'HR', 'MAHA': 'MH', 'DELH': 'DL', 'GUJA': 'GJ', 'UTTA': 'UP', 'KARN': 'KA', 'TAMI': 'TN', 'WEST': 'WB', 'PUNJ': 'PB', 'RAJA': 'RJ', 'MADH': 'MP', 'ORIS': 'OD' };
        const matchedState = states.find(s => s.name.toLowerCase() === geoName.toLowerCase());

        // Use the proper state ID if matched, otherwise fallback to the geojson's string
        const fallbackProp = feature.properties.id ? (fallbackIds[feature.properties.id] || feature.properties.id) : null;
        const stateId = matchedState ? matchedState.id : (fallbackProp || geoName.replace(/\s+/g, '-'));

        const pathStr = pathGen(feature);
        const centroid = pathGen.centroid(feature);
        let polyWidth = 0, polyHeight = 0;
        try {
            const bounds = pathGen.bounds(feature);
            if (bounds && bounds[0] && bounds[1]) {
                polyWidth = bounds[1][0] - bounds[0][0];
                polyHeight = bounds[1][1] - bounds[0][1];
            }
        } catch (e) { /* ignore bounds error for weird shapes */ }

        // Path
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathStr);
        path.classList.add("india-state-path");
        path.setAttribute("data-state-id", stateId);
        path.setAttribute("data-state-name", geoName);

        // Native tooltip for hover
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = geoName;
        path.appendChild(title);

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

                // Active styles - targeted removal instead of querySelectorAll
                if (window._activeStatePath) window._activeStatePath.classList.remove('selected');
                if (window._activeStateLabel) window._activeStateLabel.classList.remove('active');

                path.classList.add('selected');
                const lbl = document.getElementById(`lbl-${stateId}`);
                if (lbl) lbl.classList.add("active");

                window._activeStatePath = path;
                window._activeStateLabel = lbl;

                if (matchedState) _showStateStats(matchedState);

                clearTimeout(_stateClickTimer);
                _stateClickTimer = setTimeout(() => {
                    _lastClickedStateId = null;
                }, 400); // 400ms tolerance
            }
        });

        svg.appendChild(path);

        // Label — Strict physical bounding box check to prevent state names from overlapping
        if (geoName && centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
            const charCount = geoName.length;
            // Using a static 9.5px font for Tier 1 states (viewBox 800x800)
            // A long, thin rectangle could have a large bounding box but little area, so we over-estimate bounds.
            const requiredWidth = (charCount * 6.5) + 20;
            const requiredHeight = 35;

            if (polyWidth > requiredWidth && polyHeight > requiredHeight) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", centroid[0]);
                text.setAttribute("y", centroid[1] + 3); // vertical optical center
                text.setAttribute("text-anchor", "middle");
                text.id = `lbl-${stateId}`;
                text.classList.add("state-label");
                text.textContent = geoName;
                text.setAttribute("font-size", "9.5px");
                text.style.pointerEvents = "none";
                svg.appendChild(text);
            }
        }
    });
}

function _showStateStats(state) {
    _expandTierOnePanel();
    const bar = document.getElementById("hs-state-stats-bar");

    // De-bounce DOM updates using requestAnimationFrame to prevent forced synchronous layouts
    requestAnimationFrame(() => {
        bar.classList.remove("hidden");
        bar.style.transition = 'none';
        bar.classList.add("slide-out");

        requestAnimationFrame(() => {
            bar.style.transition = '';
            bar.classList.remove("slide-out");
        });
    });

    document.getElementById("hs-state-stats-name").textContent = state.name;
    const alertsEl = document.getElementById("hs-state-stats-alerts");
    const popEl = document.getElementById("hs-state-stats-pop");
    const hasData = state.dataPoints > 0;

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
        popEl.textContent = t("ui.noData");
        alertsEl.textContent = t("ui.noData");
        alertsEl.classList.remove("danger-text");
        alertsEl.style.color = "rgba(255,255,255,0.4)";
    }

    // Setup button for explicit navigation
    const actionContainer = document.getElementById("hs-state-stats-action");
    actionContainer.innerHTML = `
        <button id="hs-stats-enter-state-btn" class="hs-enter-btn">${t("ui.viewDistricts")}</button>
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

    // Clear district search on every state transition
    const t2search = document.getElementById("hs-t2-search");
    if (t2search) {
        t2search.value = "";
        // Remove any leftover dim classes from a previous state
        document.querySelectorAll(".hdist-poly, .hdist-lbl").forEach(el => {
            el.classList.remove("search-dim", "search-match");
        });
    }

    // Fetch districts with current timeline range to match hierarchy filtering
    const districts = await _ctx.ds.getDistrictsForState(state.id, _ctx.state.timelineRange);
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

        // Pre-build lookup structures once, outside the per-feature loop
        const districtById = new Map(districts.map(d => [d.id, d]));
        let allCandidates = [];
        let candToDist = new Map();
        districts.forEach(d => {
            const candidates = [d.name, ...(d.aliases || [])];
            candidates.forEach(c => {
                allCandidates.push(c);
                candToDist.set(c, d);
            });
        });

        // Draw ALL features from the GeoJSON to form the complete state map
        stateGeo.features.forEach(feature => {
            const name = feature.properties.name || feature.properties.NAME_2 || feature.properties.dtname || "";
            const geoId = (feature.properties.id || "").toLowerCase().trim();
            const pathStr = pathGen(feature);
            const centroid = pathGen.centroid(feature);

            // Match strategy: exact ID first (avoids Levenshtein false-positives between
            // similarly spelled districts, e.g. Jaipur/Udaipur which have edit-distance 2),
            // then fall back to fuzzy name matching for legacy/alias name variations.
            let matchedDistrict = districtById.get(geoId) || null;
            if (!matchedDistrict) {
                const bestMatchString = fuzzyMatch(name, allCandidates, 2);
                const fuzzyResult = bestMatchString ? candToDist.get(bestMatchString) : null;
                // Guard: if this GeoJSON feature has an explicit `id`, only accept the fuzzy
                // result when the matched district's id equals the GeoJSON id. This prevents
                // cross-assignment between similarly-named districts (e.g. Udaipur → Jaipur
                // edit-distance 2) when the GeoJSON's own id makes the correct district clear.
                if (fuzzyResult && geoId && fuzzyResult.id !== geoId) {
                    matchedDistrict = null; // GeoJSON id disagrees — treat as unregistered
                } else {
                    matchedDistrict = fuzzyResult;
                }
            }

            const districtObj = matchedDistrict || {
                id: geoId || name.toLowerCase().replace(/\s+/g, '-'),
                name: name,
                stateId: _tierTwoState.id,
                dataPoints: 0
            };

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathStr);
            path.setAttribute("data-district-name", name.toLowerCase());
            path.classList.add("hdist-poly");

            // Native tooltip for hover
            const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
            title.textContent = districtObj.name;
            path.appendChild(title);

            if (districtObj.id === _ctx.state.currentDistrictId) path.classList.add("active");

            // Calculate bounds to determine if text fits
            const bounds = pathGen.bounds(feature);
            const polyWidth = bounds[1][0] - bounds[0][0];
            const polyHeight = bounds[1][1] - bounds[0][1];

            // District name label: strict physical fit threshold
            let text = null;
            const charCount = districtObj.name.length;
            // A 7.5px font requires roughly ~5 units of width per character in a 400x380 viewBox.
            // We pad it aggressively to account for irregular polygon shapes (L-shapes, crescents) 
            // since we are only using the bounding box, not an inscribed polygon algorithm.
            const requiredWidth = (charCount * 5.5) + 15;
            const requiredHeight = 22;

            if (polyWidth > requiredWidth && polyHeight > requiredHeight) {
                text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", centroid[0]);
                text.setAttribute("y", centroid[1] + 2.5); // optical center for 7.5px font
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("data-district-name", name.toLowerCase());
                text.classList.add("hdist-lbl");
                text.setAttribute("font-size", "7.5px");

                if (districtObj.id === _ctx.state.currentDistrictId) text.classList.add("active");
                text.textContent = districtObj.name;
                text.setAttribute("pointer-events", "none");
                svg.appendChild(text);
            }

            if (matchedDistrict) {
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
            } else {
                path.classList.add("unsupported");
                path.style.opacity = "0.35";
                if (text) {
                    text.setAttribute("font-size", "7");
                    text.setAttribute("fill", "rgba(255,255,255,0.28)");
                }
            }

            // Double click handler
            path.addEventListener("click", () => {
                if (lastClickedId === districtObj.id) {
                    clearTimeout(clickTimer);
                    lastClickedId = null;
                    _selectDistrict(districtObj);
                } else {
                    lastClickedId = districtObj.id;

                    if (window._activeDistPath) window._activeDistPath.classList.remove('active');
                    if (window._activeDistLabel) window._activeDistLabel.classList.remove('active');

                    path.classList.add('active');
                    if (text) text.classList.add('active');

                    window._activeDistPath = path;
                    window._activeDistLabel = text || null;

                    _showStatsPanel(districtObj); // Trigger side panel regardless of visual label
                    clearTimeout(clickTimer);
                    clickTimer = setTimeout(() => { lastClickedId = null; }, 400);
                }
            });

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

                if (window._activeGridRect) window._activeGridRect.classList.remove('active');
                rect.classList.add('active');
                window._activeGridRect = rect;

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
        alertsEl.textContent = t("ui.noData");
        alertsEl.classList.remove("danger-text");
        alertsEl.style.color = "rgba(255,255,255,0.4)";
    } else {
        alertsEl.textContent = district.dataPoints;
        alertsEl.classList.add("danger-text");
        alertsEl.style.color = "";
    }

    // Inject "View Map" button — also bound to same _selectDistrict action
    actionEl.innerHTML = `<button class="hs-district-action-btn">${t("ui.viewMap")}</button>`;
    actionEl.querySelector("button").onclick = () => _selectDistrict(district);
}

function _selectDistrict(district) {
    // Prevent re-loading the same district (would reset temporal slate)
    if (district.id === _ctx.state.currentDistrictId) {
        close();
        return;
    }
    close();
    // Emit district change — orchestrator owns the data reload
    _ctx.emit("hierarchy:districtSelected", { districtId: district.id, stateId: district.stateId });
}

function _backToTier1() {
    document.getElementById("hs-tier2").classList.add("hidden");
    document.getElementById("hs-tier1").style.display = "";
    _expandTierOnePanel();
}

function _collapseTierOnePanel() {
    const panel = document.getElementById("hs-right-panel");
    if (!panel) return;
    panel.classList.add("collapsed");
}

function _expandTierOnePanel() {
    const panel = document.getElementById("hs-right-panel");
    if (!panel) return;
    panel.classList.remove("collapsed");
}
