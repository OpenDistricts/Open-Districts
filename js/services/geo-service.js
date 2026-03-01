// ─── GEO SERVICE — OpenDistricts V4 ───────────────────────────────────────────
// GeoJSON loading, caching, and bounding box helpers.
// All geographic data access flows through this module.

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
    // Derive approximate center from known districts
    const CENTERS = {
        "khordha": { lat: 20.18, lng: 85.76, spread: 0.22 },
        "cuttack": { lat: 20.46, lng: 85.88, spread: 0.18 },
        "puri": { lat: 19.81, lng: 85.83, spread: 0.20 },
        "ganjam": { lat: 19.73, lng: 84.81, spread: 0.30 },
        "balangir": { lat: 20.58, lng: 83.22, spread: 0.28 },
        "pune": { lat: 18.80, lng: 74.05, spread: 0.60 },
        "mumbai": { lat: 19.08, lng: 72.87, spread: 0.19 },
        "nagpur": { lat: 21.10, lng: 79.07, spread: 0.33 }
    };

    // Extract district key from URL path
    const parts = url.split("/");
    const fileName = (parts.pop() ?? "").replace(".geojson", "").replace("404-fallback-trigger", "stress");
    const c = CENTERS[fileName] ?? { lat: 20.0, lng: 85.0, spread: 0.3 };

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

    // ── Khordha district: block-level mock polygons ──────────────────
    // IDs match mock-events.js regionId values exactly (DEV-04 fix)
    if (fileName === "khordha") {
        const BLOCKS = [
            { id: "balianta-block", lat: 20.1847, lng: 85.7891, name: "Balianta Block" },
            { id: "tangi-block", lat: 20.0634, lng: 85.9271, name: "Tangi Block" },
            { id: "bolagarh-block", lat: 20.1189, lng: 85.5843, name: "Bolagarh Block" },
            { id: "jatni-block", lat: 20.1694, lng: 85.7066, name: "Jatni Block" },
            { id: "khordha-block", lat: 20.1820, lng: 85.6145, name: "Khordha Block" },
            { id: "cuttack-block", lat: 20.4625, lng: 85.8828, name: "Cuttack Block" },
            { id: "bhubaneswar", lat: 20.2961, lng: 85.8245, name: "Bhubaneswar" },
        ];
        const sq = 0.08; // ~9km block size
        return {
            type: "FeatureCollection",
            features: BLOCKS.map(b => ({
                type: "Feature",
                id: b.id,
                properties: { id: b.id, name: b.name, districtId: "khordha" },
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [b.lng - sq, b.lat - sq],
                        [b.lng + sq, b.lat - sq],
                        [b.lng + sq, b.lat + sq],
                        [b.lng - sq, b.lat + sq],
                        [b.lng - sq, b.lat - sq]
                    ]]
                }
            }))
        };
    }

    // Generate a rough convex polygon around center
    const s = c.spread;
    const coords = [
        [c.lng - s * 0.4, c.lat + s],
        [c.lng + s * 0.6, c.lat + s * 0.8],
        [c.lng + s, c.lat + s * 0.2],
        [c.lng + s * 0.8, c.lat - s * 0.5],
        [c.lng + s * 0.1, c.lat - s],
        [c.lng - s * 0.6, c.lat - s * 0.7],
        [c.lng - s, c.lat - s * 0.1],
        [c.lng - s * 0.7, c.lat + s * 0.5],
        [c.lng - s * 0.4, c.lat + s]  // close ring
    ];

    return {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                id: fileName,
                properties: { name: fileName, districtId: fileName },
                geometry: { type: "Polygon", coordinates: [coords] }
            }
        ]
    };
}
