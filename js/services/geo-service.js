// ─── GEO SERVICE - OpenDistricts V4 ───────────────────────────────────────────
// GeoJSON loading, caching, and bounding box helpers.
// All geographic data access flows through this module.

import { MOCK_DISTRICTS, MOCK_REGIONS } from '../../data/mock-districts.js';

// ── CACHE ─────────────────────────────────────────────────────────────────────

const _geoCache = new Map(); // url → GeoJSON FeatureCollection

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Load a GeoJSON file by URL. Caches the result in memory.
 * Falls back to mock inline geometry when the URL is not available
 * (dev mode - real files will be served at those paths in production).
 *
 * @param {string} url
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function loadGeoJSON(url) {
    if (_geoCache.has(url)) return _geoCache.get(url);

    // Handle Data URIs - used for unmapped districts with dynamically generated GeoJSON
    if (url && url.startsWith('data:')) {
        try {
            const commaIdx = url.indexOf(',');
            const encoded = url.slice(commaIdx + 1);
            const json = JSON.parse(decodeURIComponent(encoded));
            _geoCache.set(url, json);
            return json;
        } catch (e) {
            console.warn('[GeoService] Failed to parse Data URI GeoJSON', e);
        }
    }

    // Hardcoded regex for files known to safely exist on disk.
    // Prevents throwing standard 404s in the browser devtools console!
    const KNOWN_GEOJSON_PATTERN = /india-states(-simplified)?\.geojson|\/geo\/[A-Z]{2}(\/.*)?\.geojson/;
    if (!KNOWN_GEOJSON_PATTERN.test(url)) {
        console.info(`[GeoService] Auto-stubbing geometry grid for unresolved file: ${url}`);
        const mock = _getMockGeometry(url);
        _geoCache.set(url, mock);
        return mock;
    }

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        _geoCache.set(url, data);
        return data;
    } catch (err) {
        console.warn(`[GeoService] Could not load ${url}. Using mock geometry.`, err.message);
        const mock = _getMockGeometry(url);
        _geoCache.set(url, mock);
        return mock;
    }
}

/**
 * Convert a District boundingBox object to a Leaflet LatLngBounds array.
 * @param {{ north, south, east, west }} bb
 * @returns {[[number,number],[number,number]]}  [[sw], [ne]]
 */
export function boundingBoxToLeaflet(bb) {
    return [
        [bb.south, bb.west],
        [bb.north, bb.east]
    ];
}

// ── Category colour map (shades only - no pure primaries) ──────────────────────
const CAT_HUES = {
    health: { hex: "#B91C30", r: 185, g: 28, b: 48 },   // crimson-rose
    infrastructure: { hex: "#925C0C", r: 146, g: 92, b: 12 },   // amber-ochre
    mobility: { hex: "#3741A0", r: 55, g: 65, b: 160 },   // slate-indigo
    safety: { hex: "#146C64", r: 20, g: 108, b: 100 },   // teal-cyan
    weather: { hex: "#603294", r: 96, g: 50, b: 168 },   // violet-mauve
    emergency: { hex: "#A81626", r: 168, g: 22, b: 38 },   // deep-scarlet
};

// Tier-1 = animated in district view (health, emergency)
// Tier-2 = animated in live mode only (infrastructure, mobility)
// Tier-3 = never animated (safety, weather)
const CAT_TIER = {
    health: 1, emergency: 1,
    infrastructure: 2, mobility: 2,
    safety: 3, weather: 3
};

/**
 * Returns the animation tier for a category.
 * Tier 1: health/emergency (always-animate candidates)
 * Tier 2: infrastructure/mobility (live-mode only)
 * Tier 3: safety/weather (static)
 * @param {string} category
 * @returns {1|2|3}
 */
export function categoryTier(category) {
    return CAT_TIER[category] ?? 3;
}

/**
 * Build a Leaflet circle marker options object for an event's geoPoint.
 * @param {string} category  event.category
 * @param {boolean} dimmed    Whether this marker should be dimmed (not focused)
 * @returns {Object}  Leaflet CircleMarker options
 */
export function categoryMarkerOptions(category, dimmed = false) {
    const h = CAT_HUES[category] ?? CAT_HUES.safety;
    // Tier-1: largest dot; Tier-2: medium; Tier-3: small
    const tier = CAT_TIER[category] ?? 3;

    let radius = tier === 1 ? 11 : tier === 2 ? 8 : 6;
    let fillOpacity = tier === 1 ? 0.82 : tier === 2 ? 0.70 : 0.56;
    let opacity = 1.0;

    if (dimmed) {
        radius *= 0.7; // Shrink slightly
        fillOpacity *= 0.15;
        opacity = 0.15;
    }

    return {
        color: h.hex,
        fillColor: h.hex,
        radius,
        weight: tier === 1 ? 2 : 1.5,
        fillOpacity,
        opacity,
        interactive: !dimmed // Disable clicks on dimmed items
    };
}

/**
 * Build Leaflet polygon style for an incident category.
 * District View: low fill, breathe on tier-1 only (managed by JS + CSS).
 *
 * @param {string}  category  event.category
 * @param {boolean} focused   Whether this polygon is currently focused
 * @param {boolean} dimmed    Whether this polygon should be dimmed (other event is focused)
 * @returns {Object}  Leaflet PathOptions
 */
export function categoryPolygonStyle(category, focused = false, dimmed = false) {
    if (category === "none" || !category || dimmed) {
        return {
            color: "transparent",
            fillColor: "transparent",
            fillOpacity: 0,
            weight: 0,
            opacity: 0,
            interactive: !dimmed // still interactive if just 'none', but not if dimmed
        };
    }
    const h = CAT_HUES[category] ?? CAT_HUES.safety;
    const tier = CAT_TIER[category] ?? 3;
    // Tier-1 gets slightly more fill/stroke weight to signal urgency
    return {
        color: h.hex,
        fillColor: h.hex,
        fillOpacity: tier === 1 ? 0.06 : tier === 2 ? 0.05 : 0.03,
        weight: focused ? (tier === 1 ? 2.5 : 2.0) : (tier === 1 ? 1.5 : 1),
        opacity: focused ? (tier === 1 ? 0.55 : 0.44) : (tier === 1 ? 0.22 : 0.15)
    };
}

/**
 * Returns the Leaflet style for the district boundary ring.
 * Always visible. No fill.
 */
export function districtBoundaryStyle() {
    return {
        color: "rgba(13,17,23,0.15)",
        fill: false,
        weight: 1,
        interactive: false
    };
}

// ── Category display priority ─────────────────────────────────────────────────
// Lower number = higher rendering priority. Drives arbitration + layer ordering.
// Each event may carry `displayPriority` to override this default.

const CATEGORY_DISPLAY_PRIORITY = {
    emergency:      1,
    safety:         2,
    weather:        3,
    health:         4,
    mobility:       5,
    infrastructure: 6,
};

/**
 * Return the display priority for an event's category.
 * If the event carries an explicit `displayPriority` number, that wins.
 * @param {string} category
 * @param {number|undefined} override  event.displayPriority
 * @returns {number}  1 (highest) – 6 (lowest)
 */
export function getCategoryDisplayPriority(category, override) {
    if (typeof override === 'number' && override >= 1) return override;
    return CATEGORY_DISPLAY_PRIORITY[category] ?? 6;
}

/**
 * Return the hex color string for a category.
 * @param {string} category
 * @returns {string}  e.g. '#A81626'
 */
export function getCategoryColor(category) {
    return (CAT_HUES[category] ?? CAT_HUES.safety).hex;
}

// ── Category SVG icon templates ───────────────────────────────────────────────
// All icons are 16x16 on a 20x20 viewBox, rendered inside a 36px marker shell.

function _flameSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16"><path d="M10 2C8 5 6.5 7.5 6.5 10.2c0 .9.2 1.8.6 2.6-.6-.8-1-1.9-1-3-1.3 1.2-2 3-2 4.8C4.1 17.4 6.8 20 10 20s5.9-2.6 5.9-5.7c0-3.5-3.4-7-5.9-12.3zm0 15.2a3.2 3.2 0 01-3.2-3.2c0-.6.17-1.2.48-1.7.5.7 1.3 1 1.3 2 .3-1.1 1-1.9 2.2-2.3-.4.7-.1 1.8.7 2.5.2.2.5.6.5 1A1.5 1.5 0 0110 17.2z" fill="${color}"/></svg>`;
}

function _warningSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16"><path d="M10 2.5L1.5 17h17L10 2.5z" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round"/><rect x="9.25" y="8" width="1.5" height="5" rx="0.75" fill="${color}"/><circle cx="10" cy="14.75" r="0.9" fill="${color}"/></svg>`;
}

function _crossSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16"><rect x="8.5" y="3" width="3" height="14" rx="1.5" fill="${color}"/><rect x="3" y="8.5" width="14" height="3" rx="1.5" fill="${color}"/></svg>`;
}

function _wrenchSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16"><path d="M15 4a4 4 0 00-5.5 4.9L3.7 14.7a1 1 0 000 1.4l.2.2a1 1 0 001.4 0L11 10.5A4 4 0 0015 4zm0 3.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" fill="${color}"/></svg>`;
}

function _carSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16"><path d="M4.5 11L6 7.5h8L15.5 11" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/><rect x="3" y="10.5" width="14" height="4" rx="1.5" fill="${color}"/><rect x="2" y="12.5" width="2" height="2" rx="0.5" fill="${color}"/><rect x="16" y="12.5" width="2" height="2" rx="0.5" fill="${color}"/><circle cx="5.5" cy="15.5" r="1.5" fill="${color}"/><circle cx="14.5" cy="15.5" r="1.5" fill="${color}"/><rect x="8.5" y="11.2" width="3" height="1.8" rx="0.5" fill="rgba(255,255,255,0.35)"/></svg>`;
}

function _cloudSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16"><path d="M14 10H6a3 3 0 110-6 3.5 3.5 0 016.8 1A2.5 2.5 0 0114 10z" fill="${color}"/><line x1="8.5" y1="13" x2="7" y2="17" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/><line x1="12" y1="13" x2="10.5" y2="17" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}

const CATEGORY_SVG_FNS = {
    emergency:      _flameSvg,
    safety:         _warningSvg,
    health:         _crossSvg,
    infrastructure: _wrenchSvg,
    mobility:       _carSvg,
    weather:        _cloudSvg,
};

/**
 * Build the HTML inner string for a Leaflet DivIcon marker.
 *
 * Usage in map-controller:
 *   L.divIcon({ html: buildMarkerIconHtml(ev), className: '',
 *               iconSize: [30, 30], iconAnchor: [15, 15] })
 *
 * @param {object}  event   Event object - must have `.category`
 * @param {boolean} dimmed  True when the marker is unfocused / dimmed
 * @returns {string} HTML string (styled by css/v4.css .od-marker classes)
 */
export function buildMarkerIconHtml(event, dimmed = false) {
    const h = CAT_HUES[event.category] ?? CAT_HUES.safety;
    const color = dimmed ? `rgba(${h.r},${h.g},${h.b},0.32)` : h.hex;
    const svgFn = CATEGORY_SVG_FNS[event.category] ?? _warningSvg;
    const stateClass = dimmed ? ' is-dimmed' : '';
    const pe = dimmed ? 'none' : 'auto';
    return `<div class="od-marker${stateClass}" style="--od-r:${h.r};--od-g:${h.g};--od-b:${h.b};pointer-events:${pe};"><span class="od-marker-glow"></span><span class="od-marker-shell">${svgFn(color)}</span><span class="od-marker-ring od-marker-ring-a"></span><span class="od-marker-ring od-marker-ring-b"></span></div>`;
}

// ── MOCK GEOMETRY FALLBACK ────────────────────────────────────────────────────
// Used in dev when the /data/geo/ path is not served.
// Returns a plausible GeoJSON polygon for the district from path parsing.

function _getMockGeometry(url) {
    const parts = url.split("/");
    const fileName = (parts.pop() ?? "").replace(".geojson", "").replace("404-fallback-trigger", "stress");

    if (fileName === "stress") {
        const features = [];
        const baseLat = 19.5;
        const baseLng = 85.0;
        let count = 0;
        for (let x = 0; x < 12; x++) {
            for (let y = 0; y < 12; y++) {
                count++;
                const lat = baseLat + x * 0.1;
                const lng = baseLng + y * 0.1;
                const coords = [
                    [lng, lat],
                    [lng + 0.08, lat],
                    [lng + 0.08, lat + 0.08],
                    [lng, lat + 0.08],
                    [lng, lat]
                ];
                features.push({
                    type: "Feature",
                    id: `stress-${count}`,
                    properties: { name: `Stress Region ${count}`, districtId: "stress" },
                    geometry: { type: "Polygon", coordinates: [coords] }
                });
            }
        }
        return { type: "FeatureCollection", features };
    }

    // Try to load district specs from our central MOCK_DISTRICTS mapping
    const district = MOCK_DISTRICTS.find(d => d.id === fileName);

    // Fallback if not registered as a known active district
    if (!district) {
        return {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                id: fileName,
                properties: { name: fileName, districtId: fileName },
                geometry: { type: "Polygon", coordinates: [[[85, 20], [86, 20], [86, 21], [85, 21], [85, 20]]] }
            }]
        };
    }

    // Intelligent Grid Stub Construction
    // Distributes the district's recognized regions equally across its bounding box
    const regions = MOCK_REGIONS[fileName] || [{ id: fileName, name: fileName }];
    const { north, south, east, west } = district.boundingBox;

    const count = regions.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellW = (east - west) / cols;
    const cellH = (north - south) / rows;

    const features = [];
    regions.forEach((region, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        // 5% margin to make regions distinct separated boxes
        const lng1 = west + col * cellW + (cellW * 0.05);
        const lat1 = south + row * cellH + (cellH * 0.05);
        const lng2 = west + col * cellW + cellW - (cellW * 0.05);
        const lat2 = south + row * cellH + cellH - (cellH * 0.05);

        features.push({
            type: "Feature",
            id: region.id, // VITAL: exactly matches regionId so D3/Leaflet binds to it
            properties: { id: region.id, name: region.name, districtId: district.id },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [lng1, lat1],
                    [lng2, lat1],
                    [lng2, lat2],
                    [lng1, lat2],
                    [lng1, lat1]
                ]]
            }
        });
    });

    return { type: "FeatureCollection", features };
}
