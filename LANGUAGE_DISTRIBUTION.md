# Language Distribution Across States & Events

## Summary
The OpenDistricts events.json contains translations in the following languages across specific states:

## State-Language Mapping

### **Gujarat (GJ)** - Surat District
**Endemic Languages:**
- 🇮🇳 **gu** (Gujarati) - Official state language
- 🇮🇳 **hi** (Hindi) - National language
- 🇮🇳 **mr** (Marathi) - Secondary language present in events

**Event Examples:**
- "Family Dies in Flyover Fall" (evt_GJ_surat_20260114_001)
- "Workers Arrested After Plant Unrest" (evt_GJ_surat_20260301_002)
- "Market Fire Rescues Successful" (evt_GJ_surat_20260301_006)

---

### **Haryana (HR)** - Gurugram District
**Endemic Languages:**
- 🇮🇳 **hi** (Hindi) - Primary/only language translated

**Event Examples:**
- "ARI Spike — Winter Pollution Impact" (evt_HR_gurugram_20260131_001)
- "Service Road Repairs — Sector 30/31" (evt_HR_gurugram_20260203_001)
- "Fatal Crash — KMP Expressway" (evt_HR_gurugram_20260218_001)

---

### **Maharashtra (MH)** - Pune District
**Endemic Languages:**
- 🇮🇳 **hi** (Hindi) - Primary language
- 🇮🇳 **mr** (Marathi) - Official state language

**Event Examples:**
- "Dump Site Fire Hospitalizes Five" (evt_MH_pune_20260301_001)
- "Propylene Tanker Overturns on Expressway" (evt_MH_pune_20260301_002)
- "Construction Stop Notices Issued" (evt_MH_pune_20260225_001)

---

### **Odisha (OD)** - Odisha District
**Endemic Languages:**
- 🇮🇳 **hi** (Hindi) - National language
- 🇮🇳 **or** (Odia) - Official state language

**Event Groups:**
- Events starting from line 1090 in events.json

---

### **Karnataka (KA)** - Bangalore/Bengaluru District
**Endemic Languages:**
- 🇮🇳 **hi** (Hindi) - National language
- 🇮🇳 **kn** (Kannada) - Official state language

**Event Groups:**
- Events starting from line 1262 in events.json

---

### **Tamil Nadu (TN)** - Chennai District
**Endemic Languages:**
- 🇮🇳 **hi** (Hindi) - National language
- 🇮🇳 **ta** (Tamil) - Official state language

**Event Groups:**
- Events starting from line 1586 in events.json

---

## Supported Languages in mock-translations.js

All language codes are now supported in the translations file with complete UI string translations:

| Code | Language | Native Name | Status |
|------|----------|-------------|--------|
| **en** | English | EN | ✅ Complete |
| **hi** | Hindi | हिन्दी | ✅ Complete |
| **gu** | Gujarati | ગુજરાતી | ✅ Complete |
| **mr** | Marathi | मराठी | ✅ Complete |
| **or** | Odia | ଓଡ଼ିଆ | ✅ Complete |
| **kn** | Kannada | ಕನ್ನಡ | ✅ Complete |
| **ta** | Tamil | தமிழ் | ✅ Complete |
| **bn** | Bengali | বাংলা | ✅ Complete |
| **pa** | Punjabi | ਪੰਜਾਬੀ | ✅ Complete |
| **te** | Telugu | తెలుగు | ⚠️ Names only |
| **ur** | Urdu | اردو | ⚠️ Names only |

## Language Selector Update

The `v4-app.js` has been updated with all language native names:
- Kannada (ಕನ್ನಡ) added
- Punjabi (ਪੰਜਾਬੀ) added
- All languages now display properly in the language selector

## Translation Keys

All translation keys follow the dot-notation format in `mock-translations.js`:
- UI keys: `ui.*` (e.g., `ui.appName`, `ui.changeArea`)
- AI intent keys: `ai.intent.*` (e.g., `ai.intent.diseaseHistory`)
- Severity keys: `sev.*` (e.g., `sev.critical`)
- Category keys: `category.*` (e.g., `category.health`)
- Detail keys: `detail.*` (e.g., `detail.cases`)

## Notes

1. **Endemic Languages:** Each state has its official language as endemic (the native language of that state). Hindi serves as the national language across all states.

2. **Language Selection:** The app's language selector will now display all 11 supported languages with their native scripts, allowing users to choose their preferred language based on their region.

3. **Event Translations:** Event titles and summaries in `events.json` are translated into state-endemic languages. When displaying events from a specific state, the app can prioritize showing translations in the state's official language.

4. **Future Expansion:** Telugu (te) and Urdu (ur) are scaffolded in the language selector but don't have complete UI translations in mock-translations.js yet. These can be added when needed.
