// ─── DATA SERVICE — OpenDistricts V4 ──────────────────────────────────────────
// Schema source: docs/V4-transition-schema.md — Question 3
//
// THIS IS THE ONLY MODULE v4-app.js MAY IMPORT FROM.
// v4-app.js must never import from /data/ directly.
//
// V4: resolves all calls from mock data files.
// V5: swap out the internal implementation here only. Public API is frozen.

import { MOCK_EVENTS } from "../../data/mock-events.js";
import { MOCK_DISTRICTS, MOCK_STATES, MOCK_REGIONS } from "../../data/mock-districts.js";
import { MOCK_TRANSLATIONS } from "../../data/mock-translations.js";
import { computeTimeSeries, detectResolution } from "./time-processor.js";
import { loadGeoJSON } from "./geo-service.js";

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
        let baseEvents = MOCK_EVENTS.filter(e => e.districtId === districtId);

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
     * Get a single event by its globally unique ID.
     * @param {string} eventId
     * @returns {Promise<Event|null>}
     */
    async getEventById(eventId) {
        return MOCK_EVENTS.find(e => e.id === eventId) ?? null;
    },

    // ── Geography ──────────────────────────────────────────────────────────────

    /**
     * Get all districts for a state, including their alert counts.
     * @param {string} stateId
     * @returns {Promise<District[]>}
     */
    async getDistrictsForState(stateId) {
        return MOCK_DISTRICTS.filter(d => d.stateId === stateId);
    },

    /**
     * Get a single state by ID.
     * @param {string} stateId
     * @returns {Promise<State|null>}
     */
    async getStateById(stateId) {
        return MOCK_STATES.find(s => s.id === stateId) ?? null;
    },

    /**
     * Get all states (for Tier 1 hierarchy selector).
     * @returns {Promise<State[]>}
     */
    async getAllStates() {
        return [...MOCK_STATES];
    },

    /**
     * Get a single district by ID.
     * @param {string} districtId
     * @returns {Promise<District|null>}
     */
    async getDistrictById(districtId) {
        return MOCK_DISTRICTS.find(d => d.id === districtId) ?? null;
    },

    /**
     * Get region list for a district (sub-district slugs + display names).
     * @param {string} districtId
     * @returns {Promise<Array<{id: string, name: string}>>}
     */
    async getRegionsForDistrict(districtId) {
        return MOCK_REGIONS[districtId] ?? [];
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
     * Load GeoJSON for the entire country minimap
     * @returns {Promise<GeoJSON.FeatureCollection>}
     */
    async getAllStatesGeoJSON() {
        return loadGeoJSON(`./data/geo/india-states-simplified.geojson`);
    },

    // ── Time Series ────────────────────────────────────────────────────────────

    /**
     * Get time-bucketed density data for the time axis ribbon.
     * Resolution auto-detected if not provided.
     * V5: this will proxy to GET /api/v1/time-series — same return shape.
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
     * @param {string} locale  BCP 47 code: "en" | "or" | "hi"
     * @returns {Promise<{ locale: string, strings: Object }>}
     */
    async getTranslation(locale) {
        const found = MOCK_TRANSLATIONS.find(t => t.locale === locale);
        return found ?? MOCK_TRANSLATIONS.find(t => t.locale === "en");
    },

    /**
     * Get all available locales (for language selector pills).
     * @returns {Promise<string[]>}  BCP 47 codes
     */
    async getAvailableLocales() {
        return MOCK_TRANSLATIONS.map(t => t.locale);
    },

    // ── Live Updates ───────────────────────────────────────────────────────────

    /**
     * Subscribe to live event updates for a district.
     * V4: no-op (mock shows always-live status — green dot always on).
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
     * Connection status observable — read by top bar sync dot.
     * V4: always "live". V5: "live" | "reconnecting" | "offline"
     * @returns {"live"|"reconnecting"|"offline"}
     */
    getConnectionStatus() {
        return "live";
    }

};
