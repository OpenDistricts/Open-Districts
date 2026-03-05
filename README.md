# Open-Districts

### *Fixing the local information blind spot.*

[![Status: Proof of Concept](https://img.shields.io/badge/Status-Proof%20of%20Concept-orange?style=for-the-badge)](https://github.com/OpenDistricts/Open-Districts)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](LICENSE)
[![Built With: Vanilla JS + D3](https://img.shields.io/badge/Built%20With-Vanilla%20JS%20%2B%20D3-yellow?style=for-the-badge)](#)

> **[▶ Live Demo →](https://opendistricts.github.io/Open-Districts/OpenDistricts-v4.html)**
> *No login. No install. Open it and explore.*

---

## The Problem — The Blind Spot

We live in an age of information abundance, but that abundance is a lie at the local level.

Global stock markets are updated by the millisecond. A celebrity's tweet reaches millions in seconds. But **what happened two streets over, yesterday?** You probably don't know. Your neighbors don't know. And in a week, no one will remember.

This isn't a minor inconvenience. It's a structural failure with real consequences:
- A disease cluster emerges in a ward. Residents have no early warning.
- A road floods seasonally. No one documents the pattern. The municipality forgets. It floods again.
- A local safety incident occurs. Flashy regional headlines bury it within 48 hours. The community moves on, blind.

**We track the world, but we are strangers to our own neighborhoods.**

This is the local information blind spot. Open-Districts is built to fix it.

---

## The Philosophy — Why a Kiosk?

When I first approached this problem, the obvious answer was a mobile app. Everyone has a phone, right?

Wrong. The people *most* affected by the local information gap are often the ones *least* served by app-centric solutions:
- Low-income areas where phone batteries die and data is expensive.
- Elderly residents who don't install apps.
- Shared households with one device for five people.

So I chose a different anchor: the **public kiosk**.

```mermaid
flowchart LR
    subgraph BROKEN["❌ How Information Dies Today"]
        direction TB
        A[Event occurs in your neighborhood] --> B[Maybe reported locally]
        B --> C[Buried by regional news cycle]
        C --> D[Forgotten in 48 hours]
        D --> E[Community has no memory]
    end

    subgraph FIXED["✅ The Open-Districts Model"]
        direction TB
        F[Event occurs] --> G[Logged to district data repository]
        G --> H[Rendered on public kiosk + web]
        H --> I[Visible to entire community]
        I --> J[Permanent searchable memory]
    end

    style BROKEN fill:#2d1b1b,stroke:#cc3333,color:#ff9999
    style FIXED fill:#1b2d1b,stroke:#33cc66,color:#99ffaa
```

A kiosk is **always on, always charged, and always public.** It's immune to dead batteries, no-data zones, and the friction of app installation. Mounted in a panchayat office, a railway station, a community center — it becomes **a node of civic memory** that anyone can walk up to and use.

This is a **kiosk-first** design philosophy. The web app you see in this repo is the proof of concept for that kiosk's software layer.

---

## The Journey — Project Evolution

This project didn't start as Open-Districts. It was forged through several rounds of competition and a personal inflection point.

```mermaid
timeline
    title The Road to Open-Districts
    2024 - SIH Prep : Built MoSwasthya Sathi
                    : Odisha health-focused chatbot bot
                    : First time combining GeoJSON + local health data
    2025 - Generalised : Rebranded to MoSathi (My Companion)
                       : Expanded beyond health to all civic data
    2025 - NES Awards : Entered NES Innovation Awards
                      : Survived 4 rigorous elimination rounds
                      : Reached Top 50 nationally
    2025 - The Pivot : A personal event near me changed everything
                     : Realized a companion app wasn't enough
                     : Neighborhoods need a *memory*, not just a chatbot
                     : Open-Districts was born
```

The NES Innovation Awards acted as a crucible. Four rounds of rigorous judging forced me to defend every design decision, stress-test the concept, and sharpen the vision. I made the Top 50 nationally before stepping back from the final round due to prior commitments.

But something more important happened around that time. A real incident near me — one that should have been visible to my community, but wasn't — made the abstract problem viscerally concrete. A companion app that *answers questions* wasn't the solution. The solution was a system that ensures the *questions never have to be asked* because the information was never lost in the first place.

That's Open-Districts.

---

## System Architecture — Zero Cost, Zero Backend

This is a 100% client-side application. There is no server. There is no database. There is no cloud bill.

```mermaid
flowchart TD
    A[GitHub Pages 
    Free Static Hosting] -->|serves HTML, CSS, JS| B

    subgraph CLIENT["Client Browser / Kiosk Display"]
        B[OpenDistricts-v4.html\nEntry Point]
        B --> C[D3.js\nMap Rendering Engine]
        B --> D[Vanilla JS\nApp Logic + Controllers]
        B --> E[Tailwind CSS\nUI Styling]
    end

    subgraph DATA["Local Data Layer\nNo API calls. No auth. No cost."]
        F[data/geo/*.geojson\nDistrict Boundaries]
        G[data/mock-events.js\nLocal Event Feed]
        H[data/mock-districts.js\nDistrict Metadata]
        I[data/state-locales.js\nMultilingual Labels]
    end

    C -->|fetch + parse| F
    D -->|import| G
    D -->|import| H
    D -->|import| I

    style A fill:#1a1a2e,stroke:#4444ff,color:#aaaaff
    style CLIENT fill:#1a2e1a,stroke:#44bb44,color:#aaffaa
    style DATA fill:#2e1a1a,stroke:#bb4444,color:#ffaaaa
```

**What this means practically:**
- **Fork it. Edit the JSON. Push. Done.** Your district kiosk is live.
- **No API keys to manage.** No server to maintain. No database to secure.
- **No monthly cost.** GitHub Pages is free. The entire operational cost of running this for your district is $0.
- **Immune to backend failures.** The kiosk works as long as the browser loads.

This is a deliberate architectural choice to maximize accessibility and minimize the barrier to adoption globally.

---

## Screenshots

### Interactive District Map
![Main Map](asset/main_map_clean.png)
*D3.js-powered map rendering with district-level GeoJSON boundaries.*

### State & District Navigator
![State Selector](asset/state_selector.png)
*Drill down from state to district to sub-district, with live data filtering.*

### Live Mode — Real-Time Status
![Live Mode](asset/live_mode_active.png)
*Live monitoring view with active event overlays and severity indicators.*

### Guided Intelligence Panel
![AI Panel](asset/ai_panel.png)
*The AI-assisted insight panel — designed for the kiosk's conversational interface.*

### Event Detail Reports
![Event Details](asset/event_details.png)
*Weekly event logs, local advisories, and historical pattern data.*

---

## Navigating This Repository

The files in this repo tell a story. They are an evolutionary log, not a cleaned-up product release.

| File | What it is |
|---|---|
| `moswasthya-sathi-v1.html` | The original SIH prototype — a health bot for Odisha |
| `moswasthya-sathi-v2.html` | Early UI iteration, map integration begins |
| `moswasthya-sathi-v3.html` | MoSathi generalization, expanded data categories |
| `OpenDistricts-v4.html` | **← Start here.** The current PoC — full map, events, AI panel |
| `data/` | All GeoJSON boundaries and mock event/district data |
| `js/` | App controllers, services, and utility modules |
| `docs/` | Data schema reference, agent prompts, ingestion workflows |
| `scripts/` | Data processing, GeoJSON auditing, and build utilities |

**If you're a first-time visitor:** Open `OpenDistricts-v4.html` in your browser or hit the [Live Demo](https://opendistricts.github.io/Open-Districts/OpenDistricts-v4.html). Everything else is context for contributors.

---

## Data Schema — How It All Connects

Every visual on the map and every entry in the event feed traces back to local JSON/GeoJSON files. Here's the flow:

```mermaid
flowchart TD
    subgraph CONTRIBUTOR["📦 Contributor's Local Data"]
        A1[events.json\nid, category, title,\ntimestamp, geoPoint, impactScale]
        A2[geodata.geojson\nDistrict & sub-district\nboundary polygons]
        A3[districts.json\nDistrict metadata,\npopulation, locale]
    end

    subgraph ENGINE["⚙️ V4 Rendering Engine"]
        B1[Event Ingestion\n+ Validation]
        B2[GeoJSON\nParser]
        B3[District\nRegistry]
    end

    subgraph OUTPUT["🖥️ Kiosk UI"]
        C1[🗺️ Interactive Map\nEvent overlays,\nheatmaps, corridors]
        C2[📋 Event Feed\nTimeline, filters,\nweekly digest]
        C3[🤖 AI Panel\nContext-aware\ninsights]
    end

    A1 --> B1 --> C1
    A1 --> B1 --> C2
    A1 --> B1 --> C3
    A2 --> B2 --> C1
    A3 --> B3 --> C2
    A3 --> B3 --> C3

    style CONTRIBUTOR fill:#2e2a1a,stroke:#bbaa44,color:#ffeebb
    style ENGINE fill:#1a1a2e,stroke:#4444bb,color:#bbbbff
    style OUTPUT fill:#1a2e2a,stroke:#44bbaa,color:#bbffee
```

See [docs/DATA_SCHEMA_REFERENCE.md](docs/DATA_SCHEMA_REFERENCE.md) for the authoritative event schema contract. It defines every required field, enum value, and ID convention your data must follow to render correctly.

---

## Global Call for Contribution

This is not an India-only problem. Every city, every district, every neighborhood on Earth has this blind spot.

This repository is an open invitation.

### For Developers

The V4 PoC proves the visual and data layers work. What's **missing** is the intelligence layer:

- **AI Companion Integration:** Build the conversational panel that answers "What happened in my area this week?" using local event data as context.
- **Offline-First PWA:** Wrap the kiosk UI in a Progressive Web App with service workers for true offline resilience.
- **Real Data Ingestion:** Build scraper pipelines that pull from local government portals, civic APIs, or Nominatim/OSM and conform to the event schema.
- **Multilingual NLP:** The `data/state-locales.js` scaffolding is there. Build the translation pipeline to make it truly local.
- **Notification Layer:** Alert community members via SMS/WhatsApp when a high-severity event is logged in their district.

### For Data Contributors

You don't need to write a single line of code to contribute. If you know your city, your district, your neighborhood — **you are a contributor.**

1. **Fork this repository.**
2. Create a folder under `data/` for your city: `data/your-city/`
3. Add `events.json`, `districts.json`, and a GeoJSON boundary file following the schema in [docs/DATA_SCHEMA_REFERENCE.md](docs/DATA_SCHEMA_REFERENCE.md).
4. Open a Pull Request. Describe your region and data sources.

**Your city deserves a memory. Help build it.**

---

## Future Roadmap

This PoC proves the concept is viable and the data model is sound. The next phase is deeper.

| Phase | Focus |
|---|---|
| **Research** | Rigorous system design for multi-region, multi-tenant kiosk deployment at scale |
| **Architecture** | Secure AI integration — local inference or privacy-preserving API calls — so the intelligence panel works without leaking community data |
| **Infrastructure** | Explore IPFS / P2P data replication to make the memory truly decentralized |
| **Pilot** | Deploy a real kiosk in a real panchayat or community center and measure actual utility |

The long-term vision is a world where every district, town, and ward has its own persistent, searchable, community-owned information layer — not controlled by a platform, not dependent on a vendor, not silenced by an algorithm.

Open-Districts is the first step.

---

## License

This project is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for details.

---

## Disclaimer

This repository is an experimental research and prototype effort by [Anshuman Singh](https://github.com/DataBoySu).
It does not provide certified medical, safety, legal, or government advisories.
All event data in the repository is mock/illustrative data for demonstration purposes only.
