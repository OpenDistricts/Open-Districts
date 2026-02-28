**TECHNICAL IMPLEMENTATION SPECIFICATION**

**OpenDistricts**

**V3 → V4 Migration**

**LEFT = TIME · CENTER = TERRITORY · RIGHT = INTELLIGENCE**

This document is the complete technical specification for rebuilding OpenDistricts from V3 to V4. It contains every architectural decision, CSS rule, interaction flow, animation constraint, and implementation step needed for a coder to build the system without ambiguity. Nothing is left open.

| **Target Hardware** | Raspberry Pi 4 · Touchscreen display · Outdoor kiosk enclosure |
| --- | --- |
| **Reference Resolution** | 1024×600px (layout scales responsively - no hard pixel locks except max-width caps) |
| **Stack** | Vanilla HTML / CSS / JS · Leaflet.js for map · No framework required |
| **Fonts** | Syne (400-800) + DM Mono (300-500) via Google Fonts CDN |
| **Map Provider** | Leaflet + OpenStreetMap tiles with grayscale CSS filter |
| **Animation Budget** | CSS transform + opacity only · No WebGL · No canvas redraws per frame |
| **Doc Status** | All decisions locked. No open design questions. |

**SECTION 01**

# **What Changes From V3**

This is not an incremental update. V4 is a full architectural rebuild. The following elements from V3 are permanently removed before any new code is written.

### **V3 Elements - Delete Immediately**

| **Element** | **What It Was in V3** | **Why Removed** |
| --- | --- | --- |
| Right panel (fixed) | Structural sidebar taking map width | Map must always be 100vw. AI panel is now overlay only |
| Bottom ticker/strip | Scrolling event feed at bottom | Replaced by left timeline. Feed model is rejected |
| Bottom drawer | Swipe-up panel for event details | Details expand in-place within timeline card |
| AI gesture activation | Double-tap on map to open AI | AI opens via top bar button only, never gesture |
| AI pill / floating CTA | Floating AI button over map surface | No floating elements on map surface |
| Mixed sidebar | Events and AI in the same panel | Left = time only. Right = AI only. Separate domains |
| Stat cards / dashboard | Metric cards in any panel | OpenDistricts is not a dashboard |
| SVG fake polygon map | Non-Leaflet SVG map in center | Replaced by real Leaflet + GeoJSON |
| Country-wide render | Leaflet showing all of India | Map is always district-scoped. Fog-of-war enforced |
| Skeleton loaders on tiles | Animated placeholders on map load | Leaflet handles tile loading natively |
| Modals for card details | Pop-over modal on event tap | Details expand in-place within card, no modal |
| Auto-switching modes | System auto-toggling District/Live | Mode toggle is manual only, never automatic |
| Fixed 3-language hardcode | Hard-coded EN/HI/OD only | Language selector is dynamic array from config |
| Glassmorphism on map | Frosted glass panels over map | No blur effects on any map surface element |
| Emoji in interface | Any emoji character in UI | Zero emoji anywhere in the interface |

### **V3 Elements - Carry Forward (Modified)**

| **Element** | **V3 State** | **V4 Change** |
| --- | --- | --- |
| Top bar skeleton | Present but missing "Change Area" | Add district label, "Change Area" button, mode toggle, language dynamic |
| Leaflet map instance | Country-wide render | Reset to district bounds on boot. Apply grayscale filter. |
| Event data schema | Exists from V3 pipeline | No change to schema. New rendering logic only. |
| Color variables | V3 CSS variables | Replace with V4 token set (see Section 03) |
| Sync dot | Present in V3 | Carry forward. Keep live-polling JS. |
| AI intent card content | V3 MoSathi questions | Carry forward. New panel anatomy wraps them. |

**SECTION 02**

# **Layout Architecture**

The spatial contract of V4 is three domains on one screen. Left = Time. Center = Territory. Right = Intelligence. Both sidebars are position:absolute overlays. The map container is always 100vw × (100vh − topbar height). No sidebar ever changes the Leaflet container width.

### **CSS Model - Exact Implementation**

Copy this structure exactly. Do not deviate.

/\* ─── ROOT STRUCTURE ─── \*/

body { margin: 0; overflow: hidden; background: #DDE1E7; }

/\* TOP BAR \*/

# topbar {

position: absolute; top: 0; left: 0; right: 0;

height: 44px; z-index: 50;

background: rgba(13, 17, 23, 0.95);

display: flex; align-items: center; padding: 0 14px; gap: 10px;

}

/\* MAP CONTAINER - NEVER RESIZES \*/

# map {

position: absolute;

top: 44px; left: 0; right: 0; bottom: 60px; /\* 60px = time axis height \*/

width: 100vw;

/\* Leaflet container. Width NEVER changes. \*/

}

/\* LEFT TIMELINE - OVERLAY \*/

# timeline-panel {

position: absolute;

top: 44px; left: 0; bottom: 60px;

width: clamp(200px, 22vw, 248px);

z-index: 20;

background: #FFFFFF;

border-right: 1.5px solid rgba(0,0,0,0.1);

transform: translateX(0);

transition: transform 200ms ease-out;

}

# timeline-panel.hidden { transform: translateX(-100%); }

/\* RIGHT AI PANEL - OVERLAY \*/

# ai-panel {

position: absolute;

top: 44px; right: 0; bottom: 60px;

width: clamp(260px, 28vw, 300px);

z-index: 30;

background: #FFFFFF;

border-left: 2px solid #1F6FEB;

transform: translateX(100%);

transition: transform 200ms ease-out;

}

# ai-panel.open { transform: translateX(0); }

/\* TIME AXIS - ALWAYS VISIBLE \*/

# time-axis {

position: absolute;

bottom: 0; left: 0; right: 0;

height: 60px; z-index: 25;

background: rgba(13, 17, 23, 0.92);

border-top: 1px solid rgba(255,255,255,0.08);

}

### **Sidebar Width Behaviour at Common Breakpoints**

|     | **Viewport Width** | **Left Timeline** | **Right AI Panel** |
| --- | --- | --- | --- |
| Min | 768px | 200px (clamp min) | 260px (clamp min) |
| Ref | 1024px | ~226px | ~287px |
| Large | 1280px | ~282px | ~358px |
| Max | 1440px+ | 248px (clamp max) | 300px (clamp max) |

### **Sidebar Auto-Hide Inertia Logic - Required JS**

This is not optional. Implement exactly as described. The debounce prevents flicker on throw gestures.

let manuallyCollapsed = false;

let autoHideTimer = null;

// On Leaflet movestart event:

map.on('movestart', () => {

if (!manuallyCollapsed) {

timeline.classList.add('hidden');

}

clearTimeout(autoHideTimer);

});

// On Leaflet moveend event:

map.on('moveend', () => {

clearTimeout(autoHideTimer);

if (!manuallyCollapsed) {

autoHideTimer = setTimeout(() => {

timeline.classList.remove('hidden');

}, 500); // 500ms debounce after inertia stops

}

});

// Manual collapse (chevron button):

collapseBtn.addEventListener('click', () => {

manuallyCollapsed = !manuallyCollapsed;

timeline.classList.toggle('hidden', manuallyCollapsed);

});

**SECTION 03**

# **Design Tokens**

All visual values are derived from these tokens. Never hard-code a color, font, or spacing value outside this system.

### **Color Tokens**

| **Variable** | **Value** | **Usage** |
| --- | --- | --- |
| \--ink | #0D1117 | Top bar background · Spine · Primary labels |
| \--ink-mid | #30363D | Body text · Secondary labels |
| \--ink-sub | #57606A | Supporting text · Descriptions |
| \--ink-ghost | #8B949E | Timestamps · Meta · Disabled states |
| \--rule | #D0D7DE | 1px borders between elements |
| \--rule-faint | #EAEEF2 | Internal dividers within cards |
| \--bg | #F6F8FA | Panel backgrounds · Expanded card detail areas |
| \--white | #FFFFFF | Timeline panel surface · AI panel surface · Cards |
| \--primary | #1F6FEB | AI panel border · AI button · Informational events |
| \--danger | #CF222E | Critical severity · Health events · Safety events |
| \--warn | #9A6700 | Elevated severity · Mobility events · Road events |
| \--ok | #1A7F37 | Source verified tag · Infrastructure cleared |
| \--purple | #6E40C9 | Weather events · Environmental overlays (Live Mode only) |
| \--map-base | #DDE1E7 | Leaflet basemap with grayscale CSS filter applied |

### **Typography Tokens**

| **Role** | **Spec** | **Used For** |
| --- | --- | --- |
| Display heavy | Syne 700-800, 13-15px | District name · Panel headers · Section titles |
| Display medium | Syne 600, 10-11px | Event titles in timeline cards · Intent card titles |
| Data label | DM Mono 500, 8-9px UPPER | Category labels · Context bars · Zone IDs · All caps |
| Data value | DM Mono 400, 10-11px | Timestamps · Source tags · Metric values · AI results |
| Body small | DM Mono 300, 9-10px | Event summaries · Card body text |

### **Severity Class System**

Each event has a severity level mapped to a CSS class. These classes control all visual expression - polygon fill, border, node colour, card strip colour, animation class.

| **CSS Class** | **Hex** | **Score Range** | **Visual Expression** |
| --- | --- | --- | --- |
| .sev-critical | #CF222E | 75-100 | Full opacity fill · Rapid border pulse · Heavy weight node |
| .sev-elevated | #9A6700 | 50-74 | Medium fill · Slow border breathe · Medium node |
| .sev-info | #1F6FEB | 25-49 | Light fill · Static · Light node |
| .sev-clear | #1A7F37 | 0-24 | Near-transparent fill · No animation · Small node |

**SECTION 04**

# **Top Bar**

44px. Full viewport width. Dark background. Contains all system-level controls. Left-to-right order is fixed.

### **Element Order - Left to Right**

| **Order** | **Element** | **Behaviour** | **CSS Notes** |
| --- | --- | --- | --- |
| 1   | Logo "OpenDistricts" | Static text. No action. | Syne 800 12px white. flex-shrink: 0 |
| 2   | Separator | Visual divider only. | 1px vertical line. 16px tall. rgba(255,255,255,0.12) |
| 3   | District label stack | Two lines: "CURRENT DISTRICT" (tiny label) + district name (Syne 700 13px). Read-only display. | No click handler. Not the selector trigger. |
| 4   | "Change Area" button | CLICK → opens full-screen hierarchy selector. This is the only trigger for the selector. | Mono 9px UPPER. Border 1px rgba(255,255,255,0.18). Radius 2px |
| 5   | Spacer | flex: 1 pushes remaining items right. | flex-grow element |
| 6   | Language selector | Dynamic list from config. Current language highlighted. Overflow as "+N" if >3. | Mono 8px. Row of pill buttons. |
| 7   | Mode toggle | Two-state: "DISTRICT" \| "LIVE". Manual only. Segmented control. | Mono 9px UPPER. Active pill has rgba(255,255,255,0.14) bg |
| 8   | "Guided AI" button | CLICK → checks focus state → opens AI panel in correct context mode. | var(--primary) background. Mono 9px white. |
| 9   | Sync dot | Animated green dot + "LIVE" label. Pulses on live data. Changes to "Historical" text when time axis is in historical mode. | Mono 8px. Green dot animation: 2.5s opacity cycle |

**SECTION 05**

# **Left Timeline Panel**

The temporal ledger of the current district. Always open at boot, district change, and reboot. Temporarily hides during map movement (see Section 02 auto-hide logic). Contains the weekly event spine - oldest at top, newest at bottom.

### **Panel Structure**

| **Zone** | **Specification** |
| --- | --- |
| Header | 44px fixed. "WEEKLY EVENTS" label (DM Mono 8px UPPER ghost) + district name (Syne 700 13px) + collapse chevron (‹) button 24×24px. |
| Spine scroll area | flex: 1. overflow-y: auto. padding: 12px 0. Contains the .tl-spine container. |
| Collapse state | translateX(-100%) via class .hidden. A 24px sliver remains visible with the spine line as breadcrumb. Tap sliver or chevron to re-expand. |

### **Spine Architecture**

The spine is a vertical line running the full panel height, with nodes and string connectors. This must feel like a physical ledger - not a SaaS card list.

/\* ─── SPINE ─── \*/

.tl-spine {

position: relative;

padding: 0 10px 0 28px; /\* left offset creates space for spine + node \*/

}

.tl-spine::before { /\* THE SPINE LINE \*/

content: "";

position: absolute;

left: 14px; top: 0; bottom: 0;

width: 2px; /\* MINIMUM 2px - not 1px, not 1.5px \*/

background: var(--rule);

}

/\* ─── CARD ─── \*/

.tl-card {

position: relative;

margin-bottom: 16px;

cursor: pointer;

transition: opacity 150ms;

}

/\* NODE DOT - ON THE SPINE \*/

.tl-card::before {

content: "";

position: absolute;

left: -20px; top: 14px;

width: 10px; height: 10px; /\* MINIMUM 10px - not 8px \*/

border-radius: 50%;

background: var(--white);

border: 2px solid var(--rule);

z-index: 2;

}

.tl-card.sev-critical::before { border-color: var(--danger); }

.tl-card.sev-elevated::before { border-color: var(--warn); }

.tl-card.sev-info::before { border-color: var(--primary); }

/\* STRING CONNECTOR between nodes \*/

.tl-card::after {

content: "";

position: absolute;

left: -16px; top: 24px; bottom: -16px;

width: 1.5px;

background: var(--rule-faint);

z-index: 1;

}

.tl-card:last-child::after { display: none; }

/\* CARD INNER - FLAT, NOT ELEVATED \*/

.tl-card-inner {

border: 1.5px solid var(--rule);

border-radius: 2px; /\* MAXIMUM 2px - no soft corners \*/

background: var(--white);

overflow: hidden;

/\* NO box-shadow. Cards are flat. \*/

}

/\* LEFT SEVERITY BAND - FULL CARD HEIGHT \*/

.tl-card-inner::before {

content: "";

position: absolute;

left: 0; top: 0; bottom: 0;

width: 3px;

}

.tl-card.sev-critical .tl-card-inner::before { background: var(--danger); }

.tl-card.sev-elevated .tl-card-inner::before { background: var(--warn); }

.tl-card.sev-info .tl-card-inner::before { background: var(--primary); }

/\* FOCUS STATE \*/

.tl-card.focused .tl-card-inner {

border-color: var(--ink);

/\* Still NO box-shadow. Border darkens. \*/

}

.tl-card.dimmed { opacity: 0.32; pointer-events: none; }

### **Card Anatomy - HTML Structure**

| **Zone** | **Specification** |
| --- | --- |
| .tl-sev-strip (REMOVED) | The 2px top strip is replaced by the left 3px full-height band (see CSS above). Do not implement the top strip. |
| .tl-card-head | Flex row: polygon thumbnail (28×24px SVG) + meta column (location name + timestamp). |
| .tl-thumb | SVG silhouette of the region boundary. 28×24px. Static geographic memory anchor. |
| .tl-loc-name | Syne 600 10px. Single line. Ellipsis overflow. |
| .tl-time | DM Mono 400 8px UPPER ghost colour. Format: "Mon · 06:30" or "Today · 08:45" |
| .tl-summary | DM Mono 300 9.5px ink-sub. 2-3 lines max. The event in one sentence. |
| .tl-details | Hidden by default. display:block when .focused. Background: var(--bg). Contains detail rows + source tag. |
| .tl-detail-row | Flex row: 52px label (DM Mono 8px UPPER ghost, fixed width) + value (DM Mono 8.5px ink-mid). |
| .tl-source-tag | Green dot + "Verified · \[Source\]". DM Mono 8px ok colour. |

### **Focus State Behaviour**

| **Trigger** | **Result** |
| --- | --- |
| User taps a timeline card | 1\. That card gets class .focused · 2. Details section expands in-place · 3. All other cards get class .dimmed (opacity 0.32) · 4. Map zooms to fit that event's polygon bounds · 5. Polygon border intensifies on map |
| User taps map polygon | 1\. Timeline auto-scrolls to corresponding card · 2. Card gets .focused · 3. Others .dimmed · 4. No map zoom (user already on map) |
| User taps blank area of timeline | 1\. All cards lose .focused and .dimmed · 2. Map returns to district-wide view |
| User taps another card while one is focused | 1\. Previous card loses .focused → others lose .dimmed · 2. New card gets .focused · 3. Flow repeats |

**Dimming scope: ONLY other timeline cards dim. The map does not dim. The AI panel does not dim. Nothing outside the timeline panel is affected.**

**SECTION 06**

# **Map - Leaflet Implementation**

The map is always district-scoped. Never render country-wide. On boot, centre and zoom to the current district's bounding box. The map communicates territory - it is never a decorative background.

### **Leaflet Setup**

| **Parameter** | **Value** |
| --- | --- |
| Tile provider | OpenStreetMap (standard tiles). Apply grayscale CSS filter to desaturate. |
| Grayscale filter | filter: grayscale(100%) brightness(105%) contrast(88%) on the .leaflet-tile-pane element |
| Initial zoom | Fit bounds of current district GeoJSON on boot |
| Max zoom | 15 (neighbourhood level) |
| Min zoom | 10 (district level - no zooming out to see adjacent districts) |
| Zoom controls | Custom +/− buttons, position: absolute bottom-right over map. Standard Leaflet zoom control disabled. |
| Scroll wheel zoom | Enabled |
| Double-click zoom | Disabled (reserved for future use, but currently no assignment) |
| Attribution | Leaflet default attribution - keep visible |

### **GeoJSON Layer Architecture**

| **Layer** | **Data** |
| --- | --- |
| District boundary | Single polygon for the current district. Always visible. 1px solid border rgba(13,17,23,0.15). No fill. |
| Sub-district regions | Admin blocks within district. Each polygon is a Leaflet GeoJSON feature with event data in properties. |
| Incident markers | Point markers. Visible at zoom ≥ 10 only. Solid filled circles (9-12px). Red/amber/blue by severity. |
| Severity polygons | Class-based fill overlaid on sub-district polygons. Driven by event severity score. See Section 08 for animation rules. |

### **Two Map Modes**

Mode is controlled by a class on the map container element: #map.district-view or #map.live-mode. Never auto-switch. Only the top bar mode toggle changes this class.

| **Aspect** | **District View (.district-view)** | **Live Mode (.live-mode)** |
| --- | --- | --- |
| Polygon fills | 5% opacity fill. Colour by severity class. Max one animation: slow border pulse on critical zones. | Full severity fill (18-25% opacity). Breathing border animations at severity-appropriate rates. |
| Environmental overlays | NONE. No rain, no haze, no weather texture. | Active when weather data exists. Rain = CSS repeating-gradient animated via background-position. Haze = radial-gradient opacity animation. |
| Motion budget | Strictly one animation type: slow border pulse on .sev-critical zones only. 3.5s cycle. Opacity 14%→32%. | Full animation stack. See Section 08 for exact rates per severity level. |
| Visual intent | Intelligence. Calm. The territory communicates status through shading intensity. | Simulation. The map feels alive and contextual to real-world conditions. |
| Basemap tone | Standard grayscale filter (as above). | Same filter. Optionally increase contrast slightly (+5%) to make overlays pop. |

### **Environmental Overlay CSS - Live Mode Only**

/\* Activate only when parent has class .live-mode \*/

# map.live-mode .env-rain {

position: absolute; inset: 0;

background: repeating-linear-gradient(

175deg,

transparent 0px, transparent 8px,

rgba(150, 180, 210, 0.08) 8px, rgba(150, 180, 210, 0.08) 9px

);

pointer-events: none; z-index: 4;

animation: rain-fall 0.8s linear infinite;

}

@keyframes rain-fall {

0% { background-position: 0 0; }

100%{ background-position: 0 20px; }

}

# map.live-mode .env-haze {

position: absolute; inset: 0;

background: radial-gradient(

ellipse 80% 60% at 70% 30%,

rgba(200, 185, 140, 0.18) 0%, transparent 70%

);

pointer-events: none; z-index: 3;

animation: haze-shift 5s ease-in-out infinite alternate;

}

@keyframes haze-shift {

0% { opacity: 0.6; }

100%{ opacity: 1; }

}

**SECTION 07**

# **Global Time Axis**

60px. Always visible. Bottom of screen. Present in both District View and Live Mode. Hidden only during hierarchy selector. This is a data-dense temporal controller, not a decorative scrubber. It is the parent temporal controller for the entire system.

### **Structure - Two Layers in 60px**

| **Layer** | **Height** | **Contents** |
| --- | --- | --- |
| Ruler layer (top) | 28px | Structural time ruler: major tick marks at month boundaries (18-22px tall), minor ticks for days (6px). Month labels in DM Mono 8px above major ticks. Year markers at year boundaries. White-on-dark. |
| Density ribbon (bottom) | 32px | Continuous thermal heat strip. Neutral mid-grey for empty periods. Color intensity scales with event volume. Color hue weighted by dominant severity class of events in that period. No bar chart. No vertical spikes. Reads as a continuous thermal band. |
| Playhead | Full 60px | 2px vertical white line at current temporal position. Draggable scrubber handle (12px wide pill) at bottom of density ribbon. |
| Left controls zone | 60px tall, 80px wide | Play button (▶ at 700ms/step) and fast-forward (▶▶ at 350ms/step). DM Mono 10px. |
| Right meta zone | 60px tall, 120px wide | "LIVE" badge (green dot) in live mode. "HISTORICAL" in muted text when scrubbed backward. |

### **Density Ribbon Colour Encoding**

| **Data State** | **Visual** |
| --- | --- |
| No data in period | rgba(255,255,255,0.06) - near-invisible neutral |
| Events exist, info-only | rgba(31,111,235,0.25) - blue tint |
| Events exist, elevated severity | rgba(154,103,0,0.35) - amber tint |
| Events exist, critical severity | rgba(207,34,46,0.45) - red tint |
| High event density (many events same period) | Increase opacity by +0.15 per density tier above baseline |

### **Temporal Resolution - Data-Driven**

| **Dataset Resolution** | **Tick Density** | **Auto-Play Step** |
| --- | --- | --- |
| Hourly data exists | Minor ticks = 1 hour. Major ticks = day boundaries. | 1 step = 1 hour |
| Daily data only | Minor ticks = 1 day. Major ticks = month boundaries. | 1 step = 1 day |
| Monthly data only | Minor ticks = 1 month. Major ticks = year boundaries. | 1 step = 1 month |
| Mixed resolution | Use finest resolution of available data for current visible range. | Step = finest unit in current range |

### **Historical Mode - Full Behaviour**

| **Trigger** | **Scrub playhead backward from live position** |
| --- | --- |
| Top bar sync dot | Removes live animation. Text changes from "LIVE" to "HISTORICAL" in muted colour. |
| Real-time polling | PAUSED. No new data fetches while in historical mode. |
| Map render | Renders the historical snapshot for the selected date. Polygon severity states reflect data at that date. |
| Weekly timeline | Auto-scrolls to the week containing the current playhead date. Cards for other weeks are hidden or greyed. |
| AI context | If AI panel is open, its context updates to include the historical date as temporal scope. |
| Density ribbon | Applies a 45% dark overlay on all periods AFTER the current playhead position. |
| Return to live | Drag playhead to rightmost position OR tap "LIVE" badge. Polling resumes. Map updates. |

### **Auto-Play - Implementation Spec**

| **Parameter** | **Value** |
| --- | --- |
| Default speed | 700ms per step |
| Fast-forward speed | 350ms per step |
| Step unit | Current dataset resolution (see Temporal Resolution table above) |
| Animation method - District Mode | CSS opacity crossfade on severity classes. Only regions that changed severity receive an update. No full Leaflet re-render. |
| Animation method - Live Mode | Same opacity crossfade PLUS environmental overlay transitions interpolate. Rain intensity changes, haze shifts. CSS only. |
| Stop conditions | Any touch on map surface · Any touch on timeline axis · Auto-play button pressed again · End of data range reached |
| Performance rule | Never trigger a full Leaflet redraw per step. Use L.geoJSON layer.setStyle() on individual features only. CSS class swaps for severity changes. |

**SECTION 08**

# **Animation System**

All animation is functional. No animation exists for decoration. Hardware-constrained to CSS transform and opacity only. No canvas repaints per frame. No WebGL.

### **Animation Rules by Severity - Map Polygons**

| **Severity** | **District View Animation** | **Live Mode Animation** | **CSS Implementation** |
| --- | --- | --- | --- |
| .sev-critical | Border opacity: 14% → 32%. Cycle: 3.5s. ease-in-out. Max 1 animated polygon per viewport. | Border opacity: 35% → 72%. Box-shadow 0→14px. Cycle: 2.2s ease-in-out. | CSS @keyframes breathe-critical. Animation-play-state: paused in District View except on highest-severity. |
| .sev-elevated | Static. No animation. | Border opacity: 32% → 65%. Cycle: 3s ease-in-out. | CSS @keyframes breathe-elevated. Inactive in District View. |
| .sev-info | Static. | Static (border visible but no pulse). | No keyframe. Static CSS only. |
| .sev-clear | Static. | Static. | No keyframe. |

### **Animation Limits - Prevent Thermal Throttling**

| **Rule** | **Detail** |
| --- | --- |
| Max animated polygons | At any time, only the highest-severity polygon in the current viewport animates. All lower-severity polygons are static regardless of class. |
| Priority logic | JS function checks all visible GeoJSON features. Finds the one with highest severity score. Applies animation-play-state: running to that one. All others: paused. |
| Re-evaluate on | Map moveend · Data update · District change · Mode toggle |
| Environmental overlays | Always CSS compositing layer (transform/opacity). Never triggers layout reflow. GPU-accelerated via will-change: opacity. |
| Auto-play performance | Step function touches only changed features via L.geoJSON setStyle(). Logs execution time. If >16ms, skip to next step (don't queue). |

### **Flash Rate Compliance**

Per Access Board standards for public kiosks: composite flash rate within a single space must never exceed 5 Hz. All animation rates below are verified compliant.

| **Animation** | **Rate** | **Hz** | **Compliance** |
| --- | --- | --- | --- |
| Sync dot pulse | 2.5s cycle | 0.4 Hz | ✓ Compliant |
| AI dot pulse | 2.0s cycle | 0.5 Hz | ✓ Compliant |
| District View critical pulse | 3.5s cycle | 0.28 Hz | ✓ Compliant |
| Live Mode critical breathe | 2.2s cycle | 0.45 Hz | ✓ Compliant |
| Rain texture scroll | 0.8s cycle | 1.25 Hz (background-position, not luminance) | ✓ Compliant |
| Auto-play step (default) | 700ms interval | 1.4 Hz (state changes, not flash) | ✓ Compliant |
| Auto-play step (fast) | 350ms interval | 2.8 Hz (state changes, not flash) | ✓ Compliant |

**SECTION 09**

# **Right AI Panel**

A single-responsibility overlay: guided spatial intelligence. Opens via top bar button only. Never opens via gesture, double-tap, or any map interaction. Never pushes layout - it is position:absolute always.

### **Panel Anatomy**

| **Zone** | **Specification** |
| --- | --- |
| Panel header | Active dot (7px blue, pulsing) + "Guided Intelligence" (Syne 700 13px) + × close button (26×26px, 1px border, 2px radius) |
| Context bar | Single visual element that distinguishes the two modes. See context binding below. |
| Intent section | Scrollable. "SELECT A QUERY" label (DM Mono 8px UPPER ghost). Intent cards below. |
| Intent card | 1.5px solid border. 2px radius. Padding 10px 12px. Title (Syne 600 11px) + subtitle (DM Mono 8.5px ghost). Hover: border → var(--primary). |
| Result area | Appears below intent section after a card is tapped. Source verification tag (green dot) + response body (DM Mono 10.5px ink-mid, line-height 1.7). |
| Collapse sliver | position:absolute left: -24px. 24px × 48px tab. › chevron. White background, 1px border, left rounded corners. Collapses panel to 0px (not closes). |

### **Context Binding - Two States**

| **State** | **How Triggered** | **Context Bar Visual** | **Intent Cards** |
| --- | --- | --- | --- |
| General District | No timeline card is in .focused state when "Guided AI" button is tapped | var(--bg) background. DM Mono text: "DISTRICT · \[NAME\] · GENERAL" in ghost colour. | District-level queries (historical data, hospitals, safe travel, infrastructure) |
| Event-Bound | A timeline card IS in .focused state when "Guided AI" button is tapped | rgba(207,34,46,0.06) background + 1px red border. Text: "\[Event type\] · \[Location\] · \[Timestamp\]" in danger colour. | Event-specific queries (spreading?, nearest facility, historical comparison) |

Context check is a one-time snapshot at the moment the button is pressed. It does not continuously monitor focus state.

### **AI Panel Interaction Rules**

| **Action** | **Result** |
| --- | --- |
| Open AI panel (any mode) | translateX(100%) → translateX(0). 200ms ease-out. Timeline panel remains visible and interactive. |
| Close (× button) | translateX(0) → translateX(100%). Timeline state, map zoom, and card focus state are unchanged. |
| Collapse (› sliver) | Panel width → 0 (or translateX to near-fully-hidden). Small "AI" label visible on sliver. Not closed - context preserved. |
| District change while AI open | AI panel closes. Reopens in General mode for new district on next open. |
| Timeline card focus while AI open | Context bar updates dynamically if AI detects focus state change (optional enhancement - not required for V4 launch). |

**SECTION 10**

# **Full-Screen Hierarchy Selector**

Triggered by "Change Area" in the top bar. Full z-index takeover. Map, timeline, AI panel, and time axis all hidden behind the overlay. The user is outside normal operating state. Switching districts is a territorial action, not a dropdown interaction.

### **Two-Tier Architecture - India: 29 States, 700+ Districts**

| **Tier** | **What it Shows** |
| --- | --- |
| Tier 1 - State Browser | 3-column grid of all state names with their aggregate alert count badge. Search input at top for fast text access. Small decorative India outline SVG (non-interactive, orientation only) at bottom. Scrollable to all 29 states. |
| Tier 2 - District Selector | SVG district map of the selected state (real GeoJSON boundaries, simplified). Scrollable list mirror on the right side. Both views synchronised - tap polygon highlights row, tap row highlights polygon. |

### **Tier 1 - State Grid Specification**

| **Element** | **Specification** |
| --- | --- |
| Search input | Top of overlay. Full width. Placeholder: "Search state…". Filters grid in real-time. DM Mono 12px. |
| State grid | CSS grid: 3 columns. Each cell: state name (Syne 600 11px white) + alert count badge (DM Mono 8px red). Tap → loads Tier 2. |
| Active state | Currently loaded state highlighted with primary blue border in grid cell. |
| Decorative map | Small SVG of India outline (120×140px). Decorative only - not clickable. Shows orientation. Bottom of left panel. |
| Scrolling | Grid scrolls vertically within the overlay. India outline is sticky at bottom. |

### **Tier 2 - District SVG Map Specification**

| **Element** | **Specification** |
| --- | --- |
| SVG district map | Real GeoJSON boundaries for the selected state, simplified to reduce vertex count. All districts at equal scale - no size distortion. SVG fills approximately 60% of overlay width. |
| Polygon styles | Default: rgba(255,255,255,0.06) fill, rgba(255,255,255,0.18) stroke 1px. Hover: rgba(31,111,235,0.20) fill + blue stroke 1px. Active (current district): rgba(31,111,235,0.15) fill + blue stroke 1.5px. |
| Alert dots | Red circle (6px) on districts with active critical events. Layered above polygon. |
| List mirror | 190px right column. District names with alert counts. Scrollable. Tap row = select district (same as tapping polygon). |
| Back to Tier 1 | Back arrow + state name in header. Tap → returns to Tier 1 state grid. |

### **Selection Transition**

| **Action** | **Result** |
| --- | --- |
| User taps a district polygon or list row | 1\. Quick fade (200ms opacity). 2. Overlay disappears. 3. Map reloads to new district bounding box. 4. Timeline refreshes - auto-scrolls to newest event, no card focused. 5. Top bar district name updates. |
| User taps × or taps outside the content card | Overlay disappears. No district change. System returns to previous state exactly. |
| Artificial delay | None. No loading spinner. No fake progress bar. Leaflet handles tile loading naturally. |

**SECTION 11**

# **Interaction Flows**

Every user action is defined. No ambiguity. If a user action is not listed here, it does nothing.

### **Map Tap → Polygon or Marker**

| **Step** | **What Happens** |
| --- | --- |
| 1   | Identify the GeoJSON feature clicked (Leaflet click event on layer). |
| 2   | Find the corresponding event card in the timeline by matching event ID. |
| 3   | Timeline panel scrolls to that card (Element.scrollIntoView with smooth behavior). |
| 4   | Card receives class .focused. All other cards receive class .dimmed. |
| 5   | The clicked polygon border intensifies (opacity increases). Other polygons unchanged. |
| 6   | No map zoom occurs. User is on the map and controls it freely. |
| 7   | AI panel state: unchanged. |

### **Timeline Card Tap**

| **Step** | **What Happens** |
| --- | --- |
| 1   | Card receives class .focused. All others .dimmed. Details section expands in-place. |
| 2   | Map calls map.fitBounds(eventPolygon.getBounds(), {padding: \[20, 20\]}). |
| 3   | The corresponding polygon border intensifies. |
| 4   | Zoom is NOT locked. User can pan/zoom immediately after. |
| 5   | Tap elsewhere in timeline (not a card) → remove all .focused and .dimmed. Map stays at current zoom. |

### **"Guided AI" Button Tap**

| **Step** | **What Happens** |
| --- | --- |
| 1   | Check: is any .tl-card in .focused state? |
| 2a - YES | Read event ID and data from focused card. Set AI context to event-bound. Context bar becomes red-tinted with event name + timestamp. |
| 2b - NO | AI context is general district mode. Context bar is neutral grey. |
| 3   | AI panel translates in from right (translateX 100% → 0, 200ms). Left timeline remains visible. |

### **"Change Area" Button Tap**

| **Step** | **What Happens** |
| --- | --- |
| 1   | Hierarchy selector overlay appears (opacity 0 → 1, 150ms). |
| 2   | Tier 1 state grid shown. Current state is highlighted. |
| 3   | User selects state → Tier 2 district SVG loads. |
| 4   | User selects district → overlay fades out. Map reloads. |

### **Time Axis Scrub**

| **Step** | **What Happens** |
| --- | --- |
| 1   | User drags playhead handle OR taps a position on the axis. |
| 2   | System detects if playhead is left of live position (historical) or at live edge. |
| 3 - Historical | Sync dot changes text to "HISTORICAL". Polling pauses. Map renders historical snapshot. Timeline scrolls to that week. |
| 4 - Return to Live | Drag to right edge or tap "LIVE" badge → polling resumes. Map and timeline update. |

### **Mode Toggle Tap (District ↔ Live)**

| **Step** | **What Happens** |
| --- | --- |
| 1   | Toggle class on #map: .district-view ↔ .live-mode. |
| 2   | Polygon animation-play-state updates across all layers. |
| 3   | Environmental overlays (.env-rain, .env-haze) activate or deactivate via CSS class. |
| 4   | Timeline and AI panel: UNCHANGED by mode change. |

**SECTION 12**

# **Implementation Sequence**

Eight steps. Execute sequentially. Do not skip steps. Do not work on Step N+1 before Step N is visually verified. Each step has a clear definition of done.

| **Step** | **Name** | **What to Build** | **Definition of Done** |
| --- | --- | --- | --- |
| 1   | Strip V3 entirely | Delete: right panel, bottom ticker, bottom drawer, AI pill, stat cards, SVG fake map, any code referencing those. | Browser shows blank screen with top bar skeleton and map container only. No V3 artifacts in DOM. |
| 2   | CSS architecture | Implement the exact CSS model from Section 02: #map 100vw, #timeline-panel absolute overlay, #ai-panel absolute overlay, #time-axis 60px fixed bottom. | Leaflet renders without layout shift when both sidebars are toggled. Resize browser - map always fills viewport. |
| 3   | Rebuild top bar | All 9 elements in order. District label (read-only). "Change Area" button. Mode toggle. Language selector (dynamic). Guided AI button. Sync dot. | All elements visible and correctly spaced. Buttons have hover states. Sync dot animates. |
| 4   | Left timeline panel | Spine (2px line), nodes (10px), string connectors, card anatomy, focus state, collapse control, auto-hide on drag (debounce logic from Section 02). | Cards render with event data. Tap a card → focus state activates. Drag map → timeline hides, returns after 500ms. |
| 5   | Right AI panel | Overlay structure, two context states (check focus on open), intent cards, result area, collapse sliver, × close. | AI button opens panel. Context bar reflects whether a card is focused. × closes without affecting other state. |
| 6   | Wire all interactions | Map tap → timeline scroll+focus. Timeline tap → map zoom+focus. All flows from Section 11. | All 5 interaction flows in Section 11 work correctly end-to-end. |
| 7   | Replace with real Leaflet | Grayscale filter, GeoJSON district polygons, severity class system on features, zoom constraints (10-15), map drag → timeline auto-hide. | Map renders current district only. Polygons have severity classes. Zoom limits enforced. Drag hides timeline. |
| 8   | Mode toggle + hierarchy + time axis | District/Live mode classes and environmental overlays. Full-screen hierarchy selector (2-tier). Global time axis (60px, ruler + density ribbon, playhead, auto-play controls, historical mode). | All three major systems work. Mode toggle changes map visual register. Hierarchy selector navigates districts. Time axis scrub triggers historical mode. |

**SECTION 13**

# **Final Guardrails**

These are the permanent constraints. If anything in this doc conflicts with these guardrails, the guardrail wins. If a V3 instinct conflicts with these guardrails, the guardrail wins.

| **✓ DO - FIXED ARCHITECTURE** | **✕ DO NOT - PERMANENTLY REMOVED** |
| --- | --- |
| Map = 100vw × (100vh − 44px) always | Fixed column layout (no structural sidebar widths) |
| Both sidebars = position:absolute overlays | Hard-coded pixel math (232px, 792px, etc.) |
| Left panel: clamp(200px, 22vw, 248px) | Bottom drawer of any kind |
| Right AI: clamp(260px, 28vw, 300px) | Scrolling ticker or static intelligence strip |
| Time axis: 60px, always visible | AI double-tap gesture activation |
| Left panel open at boot | AI pill or floating CTA over map |
| Auto-hide: 500ms debounce after moveend | Mixed sidebar (events + AI in same panel) |
| Manually collapsed ≠ auto-return | Dashboard stat cards anywhere |
| AI opens via top bar button ONLY | Emoji in any UI element |
| AI context: snapshot at moment of open | Glassmorphism or blur on any map element |
| "Change Area" = full-screen selector | Fixed 3-language hardcode |
| Map always district-scoped (fog-of-war) | SVG fake polygon map (non-Leaflet) |
| Mode toggle = manual only | Country-wide Leaflet render |
| District View: one animation type max | Auto-switching between District/Live modes |
| Live Mode: full environmental allowed | Skeleton loaders on map tiles |
| Markers visible at Z ≥ 10 only | Modals for event card details |
| Timeline: newest at bottom, none focused on boot | Box-shadow on timeline cards (flat only) |
| Card spine: 2px, nodes 10px, left severity band 3px | Rounded corners above 2px on cards |
| Focus dimming: timeline cards only, nothing else | Top 2px severity strip (replaced by left 3px band) |
| CSS only for all animations (no canvas, no WebGL) | WebGL or canvas redraws per animation frame |
| Flash rate: never exceeds 5 Hz (Access Board) | Bar chart or spike chart on time axis density |
| Auto-play steps: class swaps only, no Leaflet redraw | Full Leaflet re-render per auto-play step |

**ALL DECISIONS LOCKED. NO OPEN ITEMS.**

This document supersedes all previous versions. Build from here.