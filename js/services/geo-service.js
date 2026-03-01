// ─── GEO SERVICE — OpenDistricts V4 ───────────────────────────────────────────
// GeoJSON loading, caching, and bounding box helpers.
// All geographic data access flows through this module.

import { MOCK_DISTRICTS, MOCK_REGIONS } from '../../data/mock-districts.js';

// ── CACHE ─────────────────────────────────────────────────────────────────────

const _geoCache = new Map(); // url → GeoJSON FeatureCollection

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Load a GeoJSON file by URL. Caches the result in memory.
 * Falls back to mock inline geometry when the URL is not available
 * (dev mode — real files will be served at those paths in production).
 *
 * @param {string} url
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function loadGeoJSON(url) {
    if (_geoCache.has(url)) return _geoCache.get(url);

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

// ── Category colour map (shades only — no pure primaries) ──────────────────────
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
 * @returns {Object}  Leaflet CircleMarker options
 */
export function categoryMarkerOptions(category) {
    const h = CAT_HUES[category] ?? CAT_HUES.safety;
    // Tier-1: largest dot; Tier-2: medium; Tier-3: small
    const tier = CAT_TIER[category] ?? 3;
    const radius = tier === 1 ? 11 : tier === 2 ? 8 : 6;
    const fillOpacity = tier === 1 ? 0.82 : tier === 2 ? 0.70 : 0.56;
    return {
        color: h.hex,
        fillColor: h.hex,
        radius,
        weight: tier === 1 ? 2 : 1.5,
        fillOpacity
    };
}

/**
 * Build Leaflet polygon style for an incident category.
 * District View: low fill, breathe on tier-1 only (managed by JS + CSS).
 *
 * @param {string}  category  event.category
 * @param {boolean} focused   Whether this polygon is currently focused
 * @returns {Object}  Leaflet PathOptions
 */
export function categoryPolygonStyle(category, focused = false) {
    if (category === "none" || !category) {
        return {
            color: "transparent",
            fillColor: "transparent",
            fillOpacity: 0,
            weight: 0,
            opacity: 0,
            interactive: false
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
