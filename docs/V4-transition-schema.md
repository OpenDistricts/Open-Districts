## Data Architecture Decision Memo  OpenDistricts V4

### Question 1 — Canonical Data Schema

**Event Object — Minimal Complete Schema**

```js
{
  id:           "evt_odisha_khordha_20250228_001",  // globally unique string
  stateId:      "OD",                               // ISO state code
  districtId:   "khordha",                          // slug, matches GeoJSON feature id
  regionId:     "balianta-block",                   // sub-district slug (nullable — event may be district-level)
  category:     "health",                           // enum: health | safety | mobility | weather | emergency | infrastructure
  severity:     "critical",                         // enum: critical | elevated | informational | clear
  severityScore: 82,                                // 0–100 numeric for density ribbon computation
  title:        "Fever Cluster — Balianta Block",
  summary:      "23 confirmed cases. PHC notified. Mobile teams dispatched.",
  timestamp:    "2025-02-28T08:45:00Z",            // ISO 8601 UTC — always UTC
  expiresAt:    "2025-03-07T08:45:00Z",            // nullable — when event auto-decays from view
  geoPoint:     { lat: 20.1847, lng: 85.7891 },    // nullable — point marker if sub-region precision exists
  source:       "ICMR / State Health Dept",
  verified:     true,
  verifiedAt:   "2025-02-28T09:10:00Z",
  meta: {                                           // category-specific structured data
    caseCount:  23,
    phcName:    "Balianta PHC",
    actionsTaken: ["Mobile teams dispatched", "104 activated"]
  }
}
```

**Why these fields specifically:** `regionId` enables sub-district polygon binding without requiring a lat/lng — critical for the rendering model where events attach to admin polygons, not GPS pins. `severityScore` (0–100) is the raw value from the pipeline; `severity` (the enum) is the UI class derived from it. Both must be present because the density ribbon needs the continuous score, but the map needs the class. `expiresAt` enables the freshness decay model from the system design doc without frontend clock logic. `meta` is a typed-but-flexible block — each category has its own fields, which avoids a massive flat schema while still being structured.

---

**District Object**

```js
{
  id:          "khordha",
  stateId:     "OD",
  name:        "Khordha",
  nameLocal:   "ଖୋର୍ଦ୍ଧା",               // primary regional script
  geoJsonUrl:  "/data/geo/OD/khordha.geojson",
  boundingBox: { north: 20.35, south: 20.01, east: 85.98, west: 85.52 },
  population:  2246341,                   // for future per-capita weighting
  activeAlertCount: 7                     // precomputed — drives hierarchy selector badge
}
```

---

**State Object**

```js
{
  id:          "OD",
  name:        "Odisha",
  nameLocal:   "ଓଡ଼ିଶା",
  geoJsonUrl:  "/data/geo/OD/state-outline.geojson",  // simplified, decorative
  districts:   ["khordha", "cuttack", "puri", ...],   // ordered array of district IDs
  activeAlertCount: 34
}
```

---

**Translation Object (i18n)**

```js
{
  locale:  "or",             // BCP 47 — "or" = Odia, "hi" = Hindi, "en" = English
  strings: {
    "ui.changeArea":     "ଅଞ୍ଚଳ ପରିବର୍ତ୍ତନ",
    "ui.guidedAI":       "ନିର୍ଦ୍ଦେଶିତ AI",
    "ui.liveMode":       "ସরাসরি",
    "ui.districtMode":   "ଜିଲ୍ଲା",
    "ui.weeklyEvents":   "ସାପ୍ତାହିକ ଘଟଣା",
    "category.health":   "ସ୍ୱାସ୍ଥ୍ୟ ଝୁଁକି",
    // ... etc
  }
}
```

Translations are keyed by dot-notation UI keys, not by element IDs. This means the translation file doesn't need to know anything about DOM structure.

---

### Question 2 — How the Time Axis Is Sourced

**Answer: frontend-computed from raw events for V4. Backend-supplied pre-aggregated buckets from V5 onward. But build the abstraction boundary now so the swap is a one-line change.**

Here is the reasoning. The density ribbon requires three things per time bucket: event count, dominant severity class, and the date range of the bucket. All three can be computed from the raw event array in a single pass — it's not an expensive operation for the data volumes a district produces (typically dozens to hundreds of events per week, not millions). Computing it on the frontend for V4 is correct.

However, the computation must live in `time-processor.js`, not in the UI rendering code. The specific function signature:

```js
// time-processor.js
export function computeTimeSeries(events, resolution) {
  // resolution: "hour" | "day" | "month"
  // returns: array of TimeBucket objects
}

// TimeBucket shape:
{
  startTs:      "2025-02-24T00:00:00Z",  // ISO UTC
  endTs:        "2025-02-25T00:00:00Z",
  eventCount:   7,
  maxSeverity:  "critical",              // highest severity event in bucket
  severityScore: 74,                     // average score of events in bucket
  hasData:      true
}
```

When V5 introduces a backend, the backend will return an array of `TimeBucket` objects in exactly this shape. The `time-processor.js` module becomes a pass-through that validates/normalises the API response. The UI never changes.

**Resolution detection logic** (this is the function that auto-selects resolution from data):

```js
export function detectResolution(events) {
  if (events.length === 0) return "day";
  const timestamps = events.map(e => new Date(e.timestamp));
  const minDiff = Math.min(...timestamps.slice(1).map((t, i) => t - timestamps[i]));
  if (minDiff < 3_600_000) return "hour";   // gaps < 1 hour → hourly
  if (minDiff < 86_400_000) return "day";   // gaps < 1 day → daily
  return "month";
}
```

---

### Question 3 — Service Abstraction Layer

**Yes. Introduce it now. It is fully aligned with V4 design intent. The proposed structure is correct with one addition.**

The three-file proposal is right. Here is the complete contract:

**File structure:**
```
/js
  v4-app.js
  /services
    data-service.js      ← single entry point for all data
    time-processor.js    ← temporal aggregation, resolution logic
    geo-service.js       ← GeoJSON loading, caching, bounding box helpers
/data
  mock-events.js         ← raw event array, separated by district
  mock-districts.js      ← district + state objects
  mock-translations.js   ← i18n strings per locale
```

**DataService contract** — these are the only functions `v4-app.js` is permitted to call:

```js
// data-service.js

export const DataService = {
  // Events
  getEventsForDistrict(districtId, dateRange)   // → Promise<Event[]>
  getEventById(eventId)                          // → Promise<Event>

  // Geography
  getDistrictsForState(stateId)                  // → Promise<District[]>
  getStateById(stateId)                          // → Promise<State>
  getAllStates()                                  // → Promise<State[]>

  // Time series (calls time-processor internally)
  getTimeSeries(districtId, resolution, range)   // → Promise<TimeBucket[]>

  // Translations
  getTranslation(locale)                          // → Promise<TranslationMap>

  // Live (V4: no-op. V5: opens WebSocket)
  subscribeLiveUpdates(districtId, callback)      // → unsubscribe function
  unsubscribeLiveUpdates(districtId)
}
```

`v4-app.js` never imports from `/data/` directly. It only imports `DataService`. When V5 swaps to a real API, only `data-service.js` changes.

**The one rule for mock data files:** Mock data must match the exact schema defined in Question 1. Not approximate it — exactly match it, including field names, types, and value enums. If the mock data deviates from the schema, the frontend code built against mock data will break when the real backend arrives. This is the primary source of technical debt the question is trying to avoid.

---

### Question 4 — Long-Term Backend Assumption

**Hybrid: REST for historical, WebSocket for live stream.**

This is the correct architecture for this system, and it should be assumed from V5 onward. Here is the reasoning and what it means for V4 decisions you must make now:

**REST (historical + initial load):**
Events from the past are immutable. Fetching them over REST with standard HTTP caching is correct and efficient. The API endpoint pattern:

```
GET /api/v1/events?districtId=khordha&from=2025-01-01&to=2025-02-28
GET /api/v1/time-series?districtId=khordha&resolution=day&from=...&to=...
GET /api/v1/districts?stateId=OD
```

**WebSocket (live stream):**
When the user is in Live Mode and the playhead is at the current time, the system subscribes to a WebSocket channel for the current district. New events arrive as delta messages — not full reloads. The message shape:

```js
{
  type:  "event.new" | "event.updated" | "event.expired",
  event: Event  // full event object on new/updated; { id } on expired
}
```

This affects the `subscribeLiveUpdates` method in DataService — it is already in the contract above. In V4, this method is a no-op (or a polling stub if you want to simulate live behavior). In V5 it opens a real WebSocket. `v4-app.js` calls `DataService.subscribeLiveUpdates(districtId, callback)` and never knows which transport is underneath.

**What this means for Event IDs:** IDs must be globally stable, not session-scoped. The format I specified — `evt_{stateId}_{districtId}_{yyyymmdd}_{seq}` — works. Do not use incrementing integers. Do not use random UUIDs generated at render time. The ID must be reproducible from the source data so that a WebSocket delta message referencing `evt_OD_khordha_20250228_001` can be matched against an already-rendered card without a full list scan.

**What this means for sync behaviour in Live Mode:** The sync dot's "LIVE" state reflects WebSocket connection status, not polling interval. In V4 mock: always show LIVE (the dot is always green). In V5: green = WebSocket open and receiving heartbeats. Yellow = reconnecting. Grey = offline. The DataService abstraction handles this internally and exposes a `connectionStatus` observable that the top bar subscribes to.

---

### Decision Summary — What to Tell the Coder

Lock these three decisions before Step 1:

**1. File structure:** Use the `/js/services/` and `/data/` split exactly as proposed. Add `geo-service.js` for GeoJSON loading.

**2. Mock data must match schema exactly.** Not approximately. The event schema from this memo is the schema. The coder writes mock data to this spec, not to whatever is convenient.

**3. `v4-app.js` is DataService-only.** Zero direct imports from `/data/`. Zero in-file arrays of events, districts, or strings. If the coder writes `const events = [{ id: 1, ... }]` inside `v4-app.js`, that is a violation to catch in review.

The time axis `time-processor.js` computes density from raw events now, accepts pre-aggregated buckets from the backend later. The function signatures are defined above — the coder implements them against mock data, not against a UI assumption.

These decisions add roughly one day of architecture setup before visual implementation begins. That day is not optional — it is what prevents the "we have to refactor everything to add a real backend" conversation in V5.