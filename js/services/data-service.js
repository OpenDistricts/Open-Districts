// ─── DATA SERVICE - OpenDistricts V4 ──────────────────────────────────────────
// Schema source: docs/V4-transition-schema.md - Question 3
//
// THIS IS THE ONLY MODULE v4-app.js MAY IMPORT FROM.
// v4-app.js must never import from /data/ directly.
//
// V4.1: resolves all calls from versioned data files at /data/live/
// Public API is frozen. Implementation fetches live dataset + mock translations.

import { MOCK_TRANSLATIONS } from "../../data/mock-translations.js";
import { DEFAULT_AVAILABLE_LOCALES, STATE_LANGUAGE_PREFERENCES } from "../../data/state-locales.js";
import { computeTimeSeries, detectResolution } from "./time-processor.js";
import { loadGeoJSON } from "./geo-service.js";

// ── LIVE DATASET CACHE ────────────────────────────────────────────────────────
// Loaded once at app boot; reused for all queries

let _liveDataCache = null;

const VALID_RENDER_AS = new Set(["marker", "multi_marker", "radial", "diffusion", "hotspot", "corridor", "polygon_fill"]);
const VALID_ADVANCED_PROFILES = new Set(["auto", "desktop", "kiosk"]);

async function _loadLiveData() {
    if (_liveDataCache) return _liveDataCache;

    try {
        const manifestRes = await fetch('./data/live/manifest.json');
        const manifest = await manifestRes.json();

        const [eventsRes, districtsRes, statesRes, regionsRes] = await Promise.all([
            fetch('./data/live/events.json'),
            fetch('./data/live/districts.json'),
            fetch('./data/live/states.json'),
            fetch('./data/live/regions.json')
        ]);

        const eventsRaw = await eventsRes.json();
        const events = eventsRaw.map(_normalizeEvent);
        const districts = await districtsRes.json();
        const states = await statesRes.json();
        const regions = await regionsRes.json();

        _liveDataCache = { manifest, events, districts, states, regions };
        console.log(`[DataService] Loaded live dataset v${manifest.datasetVersion} (${events.length} events, ${districts.length} districts, ${states.length} states)`);
        return _liveDataCache;
    } catch (err) {
        console.error('[DataService] Failed to load live data:', err);
        throw new Error('Could not load live dataset from /data/live/');
    }
}

function _normalizeEvent(event) {
    const ev = { ...event };
    ev.meta = ev.meta || {};

    if (ev.meta.clusterPoints && !ev.meta.multiPoints) {
        ev.meta.multiPoints = ev.meta.clusterPoints;
    }

    if (Array.isArray(ev.regionIds)) {
        ev.regionIds = [...new Set(
            ev.regionIds
                .map((rid) => (typeof rid === "string" ? rid.trim() : ""))
                .filter(Boolean)
        )];
    } else if (ev.regionId) {
        ev.regionIds = [ev.regionId];
    }

    // Backward-compatible anchor normalization:
    // if regionId is absent but regionIds is present, use the first region as the primary anchor.
    if ((!ev.regionId || typeof ev.regionId !== "string") && Array.isArray(ev.regionIds) && ev.regionIds.length > 0) {
        ev.regionId = ev.regionIds[0];
    }

    if (ev.spansMultipleRegions === undefined && Array.isArray(ev.regionIds) && ev.regionIds.length > 1) {
        ev.spansMultipleRegions = true;
    }

    if (!VALID_RENDER_AS.has(ev.renderAs)) {
        ev.renderAs = _inferRenderAs(ev);
    }

    if (!VALID_ADVANCED_PROFILES.has(ev.advancedProfile)) {
        ev.advancedProfile = "auto";
    }

    if (!Array.isArray(ev.advancedEffects)) {
        ev.advancedEffects = [];
    }

    return ev;
}

function _inferRenderAs(ev) {
    const hasRegion = !!ev.regionId || (Array.isArray(ev.regionIds) && ev.regionIds.length > 0);
    if (ev.impactScale === "POINT") return "marker";
    if (ev.impactScale === "LOCAL") {
        if (ev.meta?.multiPoints?.length) return "multi_marker";
        if (ev.meta?.radiusMetres) return "radial";
        if (ev.meta?.heatPoints?.length) return "hotspot";
        return "marker";
    }
    if (ev.impactScale === "WIDE") {
        if (ev.meta?.pathCoords?.length) return "corridor";
        if (ev.meta?.heatPoints?.length) return "hotspot";
        if (hasRegion) return "polygon_fill";
        if (ev.meta?.multiPoints?.length) return "multi_marker";
        return "marker";
    }
    if (ev.impactScale === "STATE") {
        if (ev.meta?.heatPoints?.length) return "hotspot";
        return hasRegion ? "polygon_fill" : "hotspot";
    }
    return "marker";
}

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

function _filterByDateRange(events, dateRange) {
    if (!dateRange) return events;
    const { from, to } = dateRange;
    return events.filter(e => {
        const t = new Date(e.timestamp).getTime();
        const fromMs = from ? new Date(from).getTime() : -Infinity;
        const toMs = to ? new Date(to).getTime() : Infinity;
        return t >= fromMs && t <= toMs;
    });
}

function _normalizeDistrictKey(value) {
    return String(value ?? "")
        .toLowerCase()
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/[_\s]+/g, "-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

// ── LIVE UPDATE STUB ──────────────────────────────────────────────────────────
// V4: polling no-op. V5: opens WebSocket for the district channel.
// v4-app.js calls subscribe and receives an unsubscribe fn. Transport is opaque.

const _liveSubscriptions = new Map(); // districtId → Set of callbacks

// ── PUBLIC API ────────────────────────────────────────────────────────────────

export const DataService = {

    // ── Events ─────────────────────────────────────────────────────────────────

    /**
     * Get all events for a district, optionally filtered by date range.
     * Returns events sorted oldest → newest (for timeline rendering).
     *
     * @param {string} districtId
     * @param {{ from?: string, to?: string }} [dateRange]  ISO UTC strings
     * @returns {Promise<Event[]>}
     */
    async getEventsForDistrict(districtId, dateRange) {
        const { events } = await _loadLiveData();
        let baseEvents = events.filter(e => e.districtId === districtId);

        const filtered = baseEvents
            .filter(e => {
                if (!dateRange) return true;
                const t = new Date(e.timestamp).getTime();
                const from = dateRange.from ? new Date(dateRange.from).getTime() : -Infinity;
                const to = dateRange.to ? new Date(dateRange.to).getTime() : Infinity;
                return t >= from && t <= to;
            });
        // Sort oldest first (newest = last in array = bottom of spine as per spec)
        return [...filtered].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
    },

    /**
     * Get ALL events regardless of district. Used when District Scope is unlocked.
     * Optionally filters events by date range for time-scrub synchronization.
     * @param {{ from?: string, to?: string }} [dateRange]  ISO UTC strings
     */
    async getAllMockEvents(dateRange) {
        const { events } = await _loadLiveData();
        const filtered = _filterByDateRange(events, dateRange);
        return [...filtered].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
    },

    /**
     * Dynamically compute time series based on a customized slice of events
     * @param {Event[]} events 
     */
    async calculateTimeSeriesDirectly(events) {
        const res = detectResolution(events);
        return computeTimeSeries(events, res);
    },

    /**
     * Get a single event by its globally unique ID.
     * @param {string} eventId
     * @returns {Promise<Event|null>}
     */
    async getEventById(eventId) {
        const { events } = await _loadLiveData();
        return events.find(e => e.id === eventId) ?? null;
    },

    // ── Geography ──────────────────────────────────────────────────────────────

    /**
     * Get all districts for a state, including their alert counts.
     * Returns districts enriched with computed dataPoints from live events.
     * Optionally filters events by date range for time-scrub synchronization.
     * @param {string} stateId
     * @param {{ from?: string, to?: string }} [dateRange]  ISO UTC strings
     * @returns {Promise<District[]>}
     */
    async getDistrictsForState(stateId, dateRange) {
        const { districts, events } = await _loadLiveData();
        const filtered = _filterByDateRange(events, dateRange);
        return districts
            .filter(d => d.stateId === stateId)
            .map(d => ({
                ...d,
                dataPoints: filtered.filter(e => e.districtId === d.id).length
            }));
    },

    /**
     * Get a single state by ID.
     * Returns state enriched with computed dataPoints from live events.
     * Optionally filters events by date range for time-scrub synchronization.
     * @param {string} stateId
     * @param {{ from?: string, to?: string }} [dateRange]  ISO UTC strings
     * @returns {Promise<State|null>}
     */
    async getStateById(stateId, dateRange) {
        const { states, events } = await _loadLiveData();
        const filtered = _filterByDateRange(events, dateRange);
        const raw = states.find(s => s.id === stateId);
        if (!raw) return null;
        return { ...raw, dataPoints: filtered.filter(e => e.stateId === stateId).length };
    },

    /**
     * Get all regions/tehsils for a district
     * @param {string} districtId
     * @returns {Promise<Array<{id: string, name: string}>>}
     */
    async getRegions(districtId) {
        const { regions } = await _loadLiveData();
        return regions[districtId] || [];
    },

    /**
     * Get all states (for Tier 1 hierarchy selector).
     * Returns states enriched with computed dataPoints from live events.
     * Optionally filters events by date range for time-scrub synchronization.
     * @param {{ from?: string, to?: string }} [dateRange]  ISO UTC strings
     * @returns {Promise<State[]>}
     */
    async getAllStates(dateRange) {
        const { states, events } = await _loadLiveData();
        const filtered = _filterByDateRange(events, dateRange);
        return states.map(s => ({
            ...s,
            dataPoints: filtered.filter(e => e.stateId === s.id).length
        }));
    },

    /**
     * Get a single district by ID.
     * Returns district enriched with computed dataPoints from live events.
     * Optionally filters events by date range for time-scrub synchronization.
     * @param {string} districtId
     * @param {string} [stateId]
     * @param {{ from?: string, to?: string }} [dateRange]  ISO UTC strings
     * @returns {Promise<District|null>}
     */
    async getDistrictById(districtId, stateId = null, dateRange) {
        const { districts, events } = await _loadLiveData();
        const filtered = _filterByDateRange(events, dateRange);
        const targetStateId = typeof stateId === "string" ? stateId.toUpperCase() : null;
        const requestKey = _normalizeDistrictKey(districtId);
        const inScope = targetStateId
            ? districts.filter(d => d.stateId === targetStateId)
            : districts;
        const matchesDistrictKey = (d) => {
            const keys = [d.id, d.name, ...(d.aliases || [])]
                .map(_normalizeDistrictKey)
                .filter(Boolean);
            return keys.includes(requestKey);
        };

        const raw = inScope.find(d => d.id === districtId)
            ?? inScope.find(matchesDistrictKey)
            ?? districts.find(d => d.id === districtId)
            ?? districts.find(matchesDistrictKey);
        const found = raw ? { ...raw, dataPoints: filtered.filter(e => e.districtId === raw.id).length } : null;
        if (found) return found;

        // Stub unsupported districts
        let bbox = { north: 28, south: 8, east: 97, west: 68 }; // Fallback India
        let geoUrl = `mock-geo-${districtId}`;
        let actualName = districtId.replace(/[-_]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        if (targetStateId) {
            try {
                const stateGeo = await this.getStateGeoJSON(targetStateId);
                if (stateGeo && stateGeo.features) {
                    const targetKey = _normalizeDistrictKey(districtId);
                    const feature = stateGeo.features.find(f => {
                        const p = f.properties || {};
                        const keys = [
                            p.id,
                            p.name,
                            p.district,
                            p.NAME_2,
                            p.NAME_3,
                            p.dtname,
                            p.DISTRICT,
                        ].map(_normalizeDistrictKey).filter(Boolean);
                        return keys.includes(targetKey);
                    });

                    if (feature) {
                        actualName = feature.properties.name || feature.properties.district || feature.properties.NAME_2 || feature.properties.dtname || actualName;

                        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
                        const traverse = (arr) => {
                            if (arr.length >= 2 && typeof arr[0] === 'number') {
                                if (arr[1] < minLat) minLat = arr[1];
                                if (arr[1] > maxLat) maxLat = arr[1];
                                if (arr[0] < minLon) minLon = arr[0];
                                if (arr[0] > maxLon) maxLon = arr[0];
                            } else if (Array.isArray(arr)) {
                                arr.forEach(traverse);
                            }
                        };
                        traverse(feature.geometry.coordinates);
                        bbox = { north: maxLat, south: minLat, east: maxLon, west: minLon };

                        // Pass real boundaries as Data URI so map displays actual polygon shape instead of rectangle
                        const fc = { type: "FeatureCollection", features: [feature] };
                        geoUrl = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fc));
                    }
                }
            } catch (e) {
                console.warn(`Could not extract geo for dynamic district ${districtId}`, e);
            }
        }

        return {
            id: districtId,
            stateId: targetStateId || "UNKNOWN",
            name: actualName,
            geoJsonUrl: geoUrl,
            boundingBox: bbox,
            population: 0,
            dataPoints: 0
        };
    },

    /**
     * Get region list for a district (sub-district slugs + display names).
     * @param {string} districtId
     * @returns {Promise<Array<{id: string, name: string}>>}
     */
    async getRegionsForDistrict(districtId) {
        const { regions } = await _loadLiveData();
        return regions[districtId] ?? [];
    },

    /**
     * Load GeoJSON for a district boundary or sub-district polygons.
     * Delegates to GeoService which handles caching and mock fallback.
     *
     * @param {string} geoJsonUrl  from District.geoJsonUrl
     * @returns {Promise<GeoJSON.FeatureCollection>}
     */
    async getGeoJSON(geoJsonUrl) {
        return loadGeoJSON(geoJsonUrl);
    },

    /**
     * Load GeoJSON for a complete state (for minimap rendering).
     * @param {string} stateId
     * @returns {Promise<GeoJSON.FeatureCollection>}
     */
    async getStateGeoJSON(stateId) {
        return loadGeoJSON(`./data/geo/${stateId}.geojson`);
    },

    /**
     * Load GeoJSON for the entire country minimap (Simplified for fast UI rendering)
     * @returns {Promise<GeoJSON.FeatureCollection>}
     */
    async getAllStatesGeoJSON() {
        return loadGeoJSON(`./data/geo/india-states-simplified.geojson`);
    },

    /**
     * Load high-accuracy GeoJSON for the entire country (Used ONLY for backend math/Turf.js location detection)
     * @returns {Promise<GeoJSON.FeatureCollection>}
     */
    async getAccurateStatesGeoJSON() {
        return loadGeoJSON(`./data/geo/india-states.geojson`);
    },

    // ── Time Series ────────────────────────────────────────────────────────────

    /**
     * Get time-bucketed density data for the time axis ribbon.
     * Resolution auto-detected if not provided.
     * V5: this will proxy to GET /api/v1/time-series - same return shape.
     *
     * @param {string}              districtId
     * @param {"hour"|"day"|"month"|"auto"} [resolution]
     * @param {{ from?: string, to?: string }} [range]
     * @returns {Promise<TimeBucket[]>}
     */
    async getTimeSeries(districtId, resolution = "auto", range) {
        const events = await this.getEventsForDistrict(districtId, range);
        const res = resolution === "auto" ? detectResolution(events) : resolution;
        return computeTimeSeries(events, res);
    },

    // ── Translations ───────────────────────────────────────────────────────────

    /**
     * Get translation map for a locale.
     * Returns English as fallback if locale is not found.
     *
     * @param {string} locale  BCP 47 code: "en" | "hi" | "gu" | "mr" | "or" | "kn" | "ta" | "bn" | "pa" | "te" | "ur"
     * @returns {Promise<{ locale: string, strings: Object }>}
     */
    async getTranslation(locale) {
        const found = MOCK_TRANSLATIONS.find(t => t.locale === locale);
        return found ?? MOCK_TRANSLATIONS.find(t => t.locale === "en");
    },

    /**
     * Get available locales for the current state context.
     * Uses central state mapping and augments with event translation locales.
     *
     * @param {string|null} stateId
     * @param {Array<Object>} events
     * @returns {Promise<string[]>}
     */
    async getAvailableLocales(stateId = null, events = []) {
        const bundleLocales = new Set(MOCK_TRANSLATIONS.map(t => t.locale));
        const preferred = STATE_LANGUAGE_PREFERENCES[stateId] ?? DEFAULT_AVAILABLE_LOCALES;
        const out = [];
        const seen = new Set();

        const pushLocale = (loc) => {
            if (!loc || seen.has(loc) || !bundleLocales.has(loc)) return;
            seen.add(loc);
            out.push(loc);
        };

        preferred.forEach(pushLocale);

        for (const ev of events ?? []) {
            if (!ev?.translations) continue;
            Object.keys(ev.translations).forEach(pushLocale);
        }

        pushLocale("en");
        return out.length ? out : ["en"];
    },

    // ── Live Updates ───────────────────────────────────────────────────────────

    /**
     * Subscribe to live event updates for a district.
     * V4: no-op (mock shows always-live status - green dot always on).
     * V5: opens WebSocket to ws://.../events/district/{districtId}
     *     Delivers { type: "event.new"|"event.updated"|"event.expired", event: Event }
     *
     * @param {string}   districtId
     * @param {Function} callback   fn({ type, event })
     * @returns {Function}  unsubscribe function
     */
    subscribeLiveUpdates(districtId, callback) {
        if (!_liveSubscriptions.has(districtId)) {
            _liveSubscriptions.set(districtId, new Set());
        }
        _liveSubscriptions.get(districtId).add(callback);

        // V4 mock: immediately signal "connected" by returning a no-op unsubscribe
        return () => {
            const subs = _liveSubscriptions.get(districtId);
            if (subs) subs.delete(callback);
        };
    },

    /**
     * Unsubscribe all callbacks for a district (on district change).
     * @param {string} districtId
     */
    unsubscribeLiveUpdates(districtId) {
        _liveSubscriptions.delete(districtId);
    },

    /**
     * Connection status observable - read by top bar sync dot.
     * V4: always "live". V5: "live" | "reconnecting" | "offline"
     * @returns {"live"|"reconnecting"|"offline"}
     */
    getConnectionStatus() {
        return "live";
    }

};
