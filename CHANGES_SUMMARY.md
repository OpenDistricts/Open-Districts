# OpenDistricts V4 — Changes Summary (V4.1)

## Overview
Four key improvements to user experience and data support have been implemented:

---

## 1. Lock Map Focus — ON by Default ✓

**Changes:**
- [OpenDistricts-v4.html](OpenDistricts-v4.html): Added `checked` attribute to the lock-map-focus checkbox
- [map-controller.js](js/controllers/map-controller.js): Initialize lock state to true on page load

**Impact:**
- Map now stays focused on events by default (no panning/zooming away)
- Users can still unlock via the settings tray if needed

---

## 2. Weekly Events Cards Title Wrapping ✓

**Changes:**
- [v4.css](css/v4.css): Updated `.tl-title-row` styling
  - Removed: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
  - Added: `word-wrap: break-word; overflow-wrap: break-word; white-space: normal;`

**Impact:**
- Event titles now wrap to multiple lines instead of being truncated
- Full titles are always visible without needing click-to-expand
- Better readability on the timeline sidebar

---

## 3. Language Selector Overlay Behavior ✓

**Changes:**
- [v4.css](css/v4.css): Redesigned language selector layout
  - Changed from inline expansion to fixed position overlay
  - Expands left from top-right corner
  - Overlays content without pushing anything
  - Items are now clickable with pointer events enabled

- [v4-app.js](js/v4-app.js): Added language item click handlers
  - Clicking a language automatically slides to it
  - Auto-closes selector after selection
  - Smooth animation to selected language

**Impact:**
- No more content shift when opening language selector
- Faster language switching via direct click
- Better mobile UX with overlay pattern

---

## 4. Language Translations Support ✓

### 4.1 Data Schema Updates

**Changes:**
- [DATA_SCHEMA_REFERENCE.md](docs/DATA_SCHEMA_REFERENCE.md):
  - Added `translations` field to event schema (OPTIONAL)
  - Format: `{ "locale": { "title": "...", "summary": "..." }, ... }`
  - Currently supported: `or` (Odia), `hi` (Hindi), `mr` (Marathi)

### 4.2 Agent Prompts Updated

**Changes:**
- [AGENT_PROMPTS.md](docs/AGENT_PROMPTS.md):
  - Added rule #16 documenting translations field
  - Guidance on which locales to support
  - Optional field pattern for Agent 1

### 4.3 Timeline Rendering

**Changes:**
- [timeline-controller.js](js/controllers/timeline-controller.js):
  - Modified `_buildCard()` to check for translations
  - Displays translated title/summary if available for current locale
  - Falls back to English if translation missing

**Implementation:**
```javascript
// Get translated title and summary if available
const currentLocale = _ctx.state.locale;
let displayTitle = ev.title;
let displaySummary = ev.summary;

if (ev.translations && ev.translations[currentLocale]) {
  const translation = ev.translations[currentLocale];
  displayTitle = translation.title || ev.title;
  displaySummary = translation.summary || ev.summary;
}
```

### 4.4 Locale Switching

- Existing `_switchLocale()` function already re-renders timeline
- Timeline automatically updates when user switches languages via selector

---

## Example Event with Translations

```json
{
  "id": "evt_OD_khordha_20251015_001",
  "stateId": "OD",
  "districtId": "khordha",
  "category": "health",
  "title": "Cholera Cluster — Balianta Block",
  "summary": "14 confirmed cases. ORS distribution active.",
  "translations": {
    "or": {
      "title": "ଚୋଲେରା ଗୋଲମାଲ — ବାଲିଆନ୍ତ ବ୍ଲକ",
      "summary": "14 ଖଚିତ ମାମଲା। ORS ବିତରଣ ସକ୍ରିୟ।"
    },
    "hi": {
      "title": "कॉलेरा क्लस्टर — बालिअंता ब्लॉक",
      "summary": "14 पुष्ट केस। ORS वितरण सक्रिय।"
    },
    "mr": {
      "title": "कॉलेरा क्लस्टर — बालिअंता ब्लॉक",
      "summary": "14 पुष्ट प्रकरणे। ORS वितरण सक्रिय।"
    }
  }
}
```

---

## Next Steps

1. **Update events.json**: Replace existing events with versions containing translations in Odia, Hindi, and Marathi
   - Use Agent 1 in AGENT_PROMPTS.md to structure new events with translations
   - Run typical event ingestion pipeline with translations enabled

2. **Test Language Switching**: Verify timeline cards update with translated content

3. **Monitor Performance**: Watch for any slowdowns with translation-heavy events

---

## Files Modified

1. [OpenDistricts-v4.html](OpenDistricts-v4.html) — 1 change (lock-map-focus default)
2. [css/v4.css](css/v4.css) — 2 sections updated (title wrapping, language selector)
3. [js/v4-app.js](js/v4-app.js) — Language selector click handlers
4. [js/controllers/map-controller.js](js/controllers/map-controller.js) — Initialize lock state
5. [js/controllers/timeline-controller.js](js/controllers/timeline-controller.js) — Translation support
6. [docs/DATA_SCHEMA_REFERENCE.md](docs/DATA_SCHEMA_REFERENCE.md) — Added translations field
7. [docs/AGENT_PROMPTS.md](docs/AGENT_PROMPTS.md) — Added translations rule

---

## Backwards Compatibility

✓ All changes are backwards compatible:
- Events without `translations` field work fine (defaults to English)
- Lock-map-focus default only affects new users or reset state
- Language selector overlay is purely visual enhancement
- Title wrapping is CSS-only, no structural changes
