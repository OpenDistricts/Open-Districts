// ─── TIME PROCESSOR — OpenDistricts V4 ────────────────────────────────────────
// Schema source: docs/V4-transition-schema.md — Question 2
// This module is the ONLY place temporal aggregation logic lives.
// v4-app.js calls DataService.getTimeSeries(), which calls this module.
// When V5 swaps to a backend pre-aggregated bucket endpoint, this module
// becomes a pass-through normaliser. The calling code never changes.

// ── RESOLUTION DETECTION ──────────────────────────────────────────────────────

/**
 * Auto-detect the appropriate time resolution from an event array.
 * Checks the minimum gap between consecutive event timestamps.
 *
 * @param {Array} events  Array of Event objects (schema: docs/V4-transition-schema.md)
 * @returns {"hour"|"day"|"month"}
 */
export function detectResolution(events) {
    if (!events || events.length === 0) return "day";
    if (events.length === 1) return "day";

    const timestamps = events
        .map(e => new Date(e.timestamp).getTime())
        .sort((a, b) => a - b);

    const diffs = [];
    for (let i = 1; i < timestamps.length; i++) {
        diffs.push(timestamps[i] - timestamps[i - 1]);
    }

    const minDiff = Math.min(...diffs);

    if (minDiff < 3_600_000) return "hour";   // gaps < 1 hour → hourly
    if (minDiff < 86_400_000) return "day";    // gaps < 1 day  → daily
    return "month";
}

// ── BUCKET COMPUTATION ────────────────────────────────────────────────────────

/**
 * Bin events into time buckets for density ribbon rendering.
 *
 * @param {Array}  events      Array of Event objects
 * @param {"hour"|"day"|"month"} resolution
 * @returns {TimeBucket[]}
 *
 * TimeBucket shape (matches the backend contract for V5):
 * {
 *   startTs:           string (ISO UTC),
 *   endTs:             string (ISO UTC),
 *   eventCount:        number,
 *   dominantCategory:  "health"|"infrastructure"|"mobility"|"safety"|"weather"|"emergency",
 *   hasData:           boolean
 * }
 */
export function computeTimeSeries(events, resolution) {
    if (!events || events.length === 0) return [];

    // Tier-1 categories animate in district view; tier-3 are static.
    // Lower tier number = more urgent.
    const CAT_TIER = {
        health: 1, emergency: 1,
        infrastructure: 2, mobility: 2,
        safety: 3, weather: 3
    };

    // Determine the full date range from the event set
    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    // Build bucket start times covering the full range
    const bucketStarts = _generateBucketStarts(minTime, maxTime, resolution);

    // Assign events to buckets
    const buckets = bucketStarts.map((startMs, i) => {
        const endMs = bucketStarts[i + 1] ?? _nextBucketStart(startMs, resolution);
        const bucketEvents = events.filter(e => {
            const t = new Date(e.timestamp).getTime();
            return t >= startMs && t < endMs;
        });

        if (bucketEvents.length === 0) {
            return {
                startTs: new Date(startMs).toISOString(),
                endTs: new Date(endMs).toISOString(),
                eventCount: 0,
                dominantCategory: "safety",
                hasData: false
            };
        }

        // Find most urgent category in bucket (lowest tier)
        const dominantEvent = bucketEvents.reduce((best, e) => {
            const bestTier = CAT_TIER[best.category] ?? 99;
            const eTier = CAT_TIER[e.category] ?? 99;
            return eTier < bestTier ? e : best;
        });

        return {
            startTs: new Date(startMs).toISOString(),
            endTs: new Date(endMs).toISOString(),
            eventCount: bucketEvents.length,
            dominantCategory: dominantEvent.category,
            hasData: true
        };
    });

    return buckets;
}

// ── DENSITY RIBBON COLOUR ─────────────────────────────────────────────────────

/**
 * Map a TimeBucket to its density ribbon RGBA colour string.
 * Encodes Section 07 density ribbon colour specification.
 * Colour is driven by incident type (category), not severity level.
 *
 * @param {Object} bucket  TimeBucket
 * @returns {string}  CSS rgba() string
 */
export function bucketToRibbonColour(bucket) {
    if (!bucket.hasData) return "rgba(255,255,255,0.06)";

    // Category hues (shades only — no pure primaries)
    const BASE = {
        health: { r: 185, g: 28, b: 48, baseOpacity: 0.44 },   // crimson-rose
        infrastructure: { r: 146, g: 92, b: 12, baseOpacity: 0.34 },   // amber-ochre
        mobility: { r: 55, g: 65, b: 160, baseOpacity: 0.28 },   // slate-indigo
        safety: { r: 20, g: 108, b: 100, baseOpacity: 0.24 },   // teal-cyan
        weather: { r: 96, g: 50, b: 168, baseOpacity: 0.26 },   // violet-mauve
        emergency: { r: 168, g: 22, b: 38, baseOpacity: 0.50 },   // deep-scarlet
    };

    const c = BASE[bucket.dominantCategory] ?? BASE.safety;

    // Density tier bonus: +0.15 per tier above baseline (tiers: 1-2, 3-5, 6+)
    let densityBonus = 0;
    if (bucket.eventCount >= 6) densityBonus = 0.30;
    else if (bucket.eventCount >= 3) densityBonus = 0.15;

    const opacity = Math.min(0.85, c.baseOpacity + densityBonus);
    return `rgba(${c.r},${c.g},${c.b},${opacity.toFixed(2)})`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function _generateBucketStarts(minMs, maxMs, resolution) {
    const starts = [];
    let current = _floorToUnit(minMs, resolution);
    while (current <= maxMs) {
        starts.push(current);
        current = _nextBucketStart(current, resolution);
    }
    return starts;
}

function _floorToUnit(ms, resolution) {
    const d = new Date(ms);
    if (resolution === "month") {
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
    if (resolution === "day") {
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    // hour
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
}

function _nextBucketStart(ms, resolution) {
    const d = new Date(ms);
    if (resolution === "month") {
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }
    if (resolution === "day") {
        return ms + 86_400_000;
    }
    return ms + 3_600_000;
}

/**
 * Format a timestamp for display in timeline cards.
 * Returns "Today · HH:MM" or "Day · HH:MM" (e.g. "Mon · 06:30")
 *
 * @param {string} isoTimestamp  ISO 8601 UTC string
 * @param {string} [nowIso]      Override "now" for testing
 * @returns {string}
 */
export function formatCardTime(isoTimestamp, nowIso) {
    const ts = new Date(isoTimestamp);
    const now = nowIso ? new Date(nowIso) : new Date();

    const isToday =
        ts.getUTCFullYear() === now.getUTCFullYear() &&
        ts.getUTCMonth() === now.getUTCMonth() &&
        ts.getUTCDate() === now.getUTCDate();

    const hh = String(ts.getUTCHours()).padStart(2, "0");
    const mm = String(ts.getUTCMinutes()).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;

    if (isToday) return `Today · ${timeStr}`;

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[ts.getUTCDay()]} · ${timeStr}`;
}
