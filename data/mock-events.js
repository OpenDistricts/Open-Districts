// ─── MOCK EVENTS — OpenDistricts V4 ───────────────────────────────────────────
// Schema source: docs/V4-transition-schema.md
// Field contract: id, stateId, districtId, regionId, category,
//   title, summary, timestamp, expiresAt, geoPoint, source,
//   verified, verifiedAt, meta
// Coloring is encoded by `category` (incident type) — no severity field.
// DO NOT deviate from field names or value enums.

export const MOCK_EVENTS = [

  // ── Khordha District ──────────────────────────────────────────────────────

  {
    id: "evt_OD_khordha_20250225_001",
    stateId: "OD",
    districtId: "khordha",
    regionId: "balianta-block",
    category: "health",
    title: "Fever Cluster — Balianta Block",
    summary: "23 confirmed cases of seasonal fever. PHC notified. Mobile teams dispatched.",
    timestamp: "2025-02-25T08:45:00Z",
    expiresAt: "2025-03-04T08:45:00Z",
    geoPoint: { lat: 20.1847, lng: 85.7891 },
    source: "ICMR / State Health Dept",
    verified: true,
    verifiedAt: "2025-02-25T09:10:00Z",
    meta: {
      caseCount: 23,
      phcName: "Balianta PHC",
      actionsTaken: ["Mobile teams dispatched", "104 activated", "ORS distribution started"]
    }
  },

  {
    id: "evt_OD_khordha_20250224_001",
    stateId: "OD",
    districtId: "khordha",
    regionId: "tangi-block",
    category: "infrastructure",
    title: "Borewell Failure — Tangi Block",
    summary: "Borewell #7 non-operational since 06:00. Alternate tanker supply arranged.",
    timestamp: "2025-02-24T06:30:00Z",
    expiresAt: "2025-02-26T12:00:00Z",
    geoPoint: { lat: 20.0634, lng: 85.9271 },
    source: "Odisha Jal Mission",
    verified: true,
    verifiedAt: "2025-02-24T07:15:00Z",
    meta: {
      borewellId: "BW-07-TANGI",
      affectedPopulation: 1200,
      actionsTaken: ["Tanker supply rerouted", "Repair crew dispatched"]
    }
  },

  {
    id: "evt_OD_khordha_20250224_002",
    stateId: "OD",
    districtId: "khordha",
    regionId: "bolagarh-block",
    category: "infrastructure",
    title: "New PHC Operational — Bolagarh",
    summary: "Primary Health Centre inaugurated. 24/7 emergency line 104 active.",
    timestamp: "2025-02-24T09:00:00Z",
    expiresAt: null,
    geoPoint: { lat: 20.1189, lng: 85.5843 },
    source: "Odisha Health Dept",
    verified: true,
    verifiedAt: "2025-02-24T09:30:00Z",
    meta: {
      phcName: "Bolagarh PHC",
      beds: 30,
      actionsTaken: ["Inauguration complete", "Staff deployed"]
    }
  },

  {
    id: "evt_OD_khordha_20250223_001",
    stateId: "OD",
    districtId: "khordha",
    regionId: "jatni-block",
    category: "health",
    title: "ASHA Worker Training — Jatni",
    summary: "Two-day community health training for 40 ASHA workers. Maternal care focus.",
    timestamp: "2025-02-23T08:00:00Z",
    expiresAt: "2025-02-24T18:00:00Z",
    geoPoint: { lat: 20.1694, lng: 85.7066 },
    source: "NHM Odisha",
    verified: true,
    verifiedAt: "2025-02-23T08:20:00Z",
    meta: {
      workerCount: 40,
      topic: "Maternal and child health",
      actionsTaken: ["Training in progress"]
    }
  },

  {
    id: "evt_OD_khordha_20250222_001",
    stateId: "OD",
    districtId: "khordha",
    regionId: "khordha-block",
    category: "health",
    title: "Vaccination Drive — Khordha Block",
    summary: "Polio and DPT vaccination camp. Target: 2,400 children under 5.",
    timestamp: "2025-02-22T09:00:00Z",
    expiresAt: "2025-02-27T16:00:00Z",
    geoPoint: { lat: 20.1820, lng: 85.6145 },
    source: "UNICEF / State Health Dept",
    verified: true,
    verifiedAt: "2025-02-22T09:15:00Z",
    meta: {
      targetCount: 2400,
      vaccinesAdministered: 1752,
      actionsTaken: ["Camp ongoing", "Cold chain maintained"]
    }
  },

  {
    id: "evt_OD_khordha_20250221_001",
    stateId: "OD",
    districtId: "khordha",
    regionId: null,
    category: "mobility",
    title: "Road Block — NH-16 Near Bhubaneswar",
    summary: "NH-16 blocked due to road repair. Diversion via SH-12. Emergency vehicles unaffected.",
    timestamp: "2025-02-21T07:00:00Z",
    expiresAt: "2025-02-23T20:00:00Z",
    geoPoint: { lat: 20.2961, lng: 85.8245 },
    source: "NHAI / Odisha PWD",
    verified: true,
    verifiedAt: "2025-02-21T07:30:00Z",
    meta: {
      highway: "NH-16",
      diversion: "SH-12",
      actionsTaken: ["Diversion signage deployed", "Traffic police stationed"]
    }
  },

  {
    id: "evt_OD_khordha_20250220_001",
    stateId: "OD",
    districtId: "khordha",
    regionId: "cuttack-block",
    category: "health",
    title: "Swine Flu Alert — Cuttack Block",
    summary: "8 confirmed H1N1 cases. 3 hospitalised. Contact tracing underway.",
    timestamp: "2025-02-20T14:00:00Z",
    expiresAt: "2025-02-27T14:00:00Z",
    geoPoint: { lat: 20.4625, lng: 85.8828 },
    source: "State Surveillance Unit",
    verified: true,
    verifiedAt: "2025-02-20T15:30:00Z",
    meta: {
      caseCount: 8,
      hospitalised: 3,
      actionsTaken: ["Contact tracing", "Antivirals at designated PHCs"]
    }
  },

  // ── Cuttack District (for hierarchy selector demo) ────────────────────────

  {
    id: "evt_OD_cuttack_20250225_001",
    stateId: "OD",
    districtId: "cuttack",
    regionId: "cuttack-sadar",
    category: "health",
    title: "Dengue Surveillance — Cuttack Sadar",
    summary: "Elevated dengue vector activity. Fogging operations in progress.",
    timestamp: "2025-02-25T10:00:00Z",
    expiresAt: "2025-03-01T10:00:00Z",
    geoPoint: { lat: 20.4625, lng: 85.8828 },
    source: "Cuttack Municipal Corp",
    verified: true,
    verifiedAt: "2025-02-25T10:45:00Z",
    meta: {
      caseCount: 14,
      actionsTaken: ["Fogging ops", "Larval source reduction"]
    }
  },

  // ── Puri District ─────────────────────────────────────────────────────────

  {
    id: "evt_OD_puri_20250224_001",
    stateId: "OD",
    districtId: "puri",
    regionId: "puri-sadar",
    category: "safety",
    title: "Beach Safety Advisory — Puri Sadar",
    summary: "Strong currents reported at beach zone 4. Lifeguards deployed.",
    timestamp: "2025-02-24T11:00:00Z",
    expiresAt: "2025-02-25T18:00:00Z",
    geoPoint: { lat: 19.8134, lng: 85.8315 },
    source: "Odisha Tourism / NDRF",
    verified: true,
    verifiedAt: "2025-02-24T11:30:00Z",
    meta: {
      zone: "Beach Zone 4",
      actionsTaken: ["6 lifeguards deployed", "Advisory boards posted"]
    }
  }

];
