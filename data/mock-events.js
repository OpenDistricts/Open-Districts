// ─── EVENTS — OpenDistricts V4 ────────────────────────────────────────────────
// Data contract: id, stateId, districtId, regionId, category,
//   title, summary, timestamp, expiresAt, geoPoint, source,
//   verified, verifiedAt, location, meta
//
// ENCODING RULE: `category` drives all coloring and animation.
// `severity` and `severityScore` are NOT part of this schema.
// DO NOT reintroduce them.
//
// regionId must exactly match a properties.id in the district's .geojson file,
// or be null if the location cannot be confidently mapped to a sub-region.

export const MOCK_EVENTS = [

  // ── Surat, Gujarat (Jan 2026 – Mar 2026) ───────────────────────────────
  // Source: Real events via Agent 1 & 2 integration pipeline

  {
    id: "evt_GJ_surat_20260114_001",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "safety",
    impactScale: "POINT",
    title: "Family Dies in Flyover Fall",
    summary: "A family of three died after their scooter hit a railing on the Chandrashekhar Azad flyover and plunged 70 feet in Adajan.",
    timestamp: "2026-01-14T16:00:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1965, lng: 72.7989 },
    location: { block: "Adajan (Chandrashekhar Azad Flyover)" },
    source: "The Week",
    verified: true,
    meta: { fatalities: 3, incidentType: "Road Accident" }
  },
  {
    id: "evt_GJ_surat_20260301_001",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "safety",
    title: "Woman Duped in Job Scam",
    summary: "A woman seeking employment in the UK was defrauded of Rs 21 lakh after receiving a fake job offer letter.",
    timestamp: "2026-03-01T05:00:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1702, lng: 72.8311 },
    location: { block: "Surat City" },
    source: "Times of India",
    verified: true,
    meta: { amountLost: 2100000, scamType: "Employment Fraud" }
  },
  {
    id: "evt_GJ_surat_20260301_002",
    stateId: "GJ",
    districtId: "surat",
    regionId: "chorasi",
    category: "safety",
    title: "Workers Arrested After Plant Unrest",
    summary: "Police arrested 40 workers at the AM/NS plant following an outbreak of unrest in Hazira.",
    timestamp: "2026-03-01T08:30:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1685, lng: 72.6567 },
    location: { block: "Hazira (AM/NS Plant)" },
    source: "Times of India",
    verified: true,
    meta: { arrests: 40, charges: "Attempted Murder" }
  },
  {
    id: "evt_GJ_surat_20260301_003",
    stateId: "GJ",
    districtId: "surat",
    regionId: null,
    category: "health",
    impactScale: "LOCAL",
    title: "HPV Vaccine Drive Launch Planned",
    summary: "A statewide vaccination campaign against Human Papillomavirus for teenage girls is set to begin full-scale operations.",
    timestamp: "2026-03-01T10:00:00Z",
    expiresAt: "2026-04-01T10:00:00Z",
    location: { block: "Surat District Health Centers" },
    source: "Indian Express",
    verified: true,
    meta: {
      targetGroup: "Teenage girls",
      vaccineType: "HPV",
      clusterPoints: [
        { lat: 21.1702, lng: 72.8311 },
        { lat: 21.1965, lng: 72.7989 },
        { lat: 21.1411, lng: 72.7758 }
      ]
    }
  },
  {
    id: "evt_GJ_surat_20260223_001",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "safety",
    title: "Diamond Traders Booked for Fraud",
    summary: "The Gajera brothers were booked in a massive Rs 1,928 crore cheating and forgery case involving funds from Ring Road textile markets.",
    timestamp: "2026-02-23T14:15:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1901, lng: 72.8433 },
    location: { block: "Ring Road Textile Market" },
    source: "DeshGujarat",
    verified: true,
    meta: { fraudAmount: 19280000000, accused: "Gajera Brothers" }
  },
  {
    id: "evt_GJ_surat_20260301_004",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "safety",
    title: "Family Dies by Suicide",
    summary: "Three members of a family committed suicide in the Vesu area following alleged harassment.",
    timestamp: "2026-03-01T06:45:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1411, lng: 72.7758 },
    location: { block: "Vesu" },
    source: "Times of India",
    verified: true,
    meta: { fatalities: 3, reason: "Harassment" }
  },
  {
    id: "evt_GJ_surat_20260301_005",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "infrastructure",
    title: "DGVCL Enhances Power Infrastructure",
    summary: "DGVCL has initiated projects to boost the power distribution infrastructure across city urban areas.",
    timestamp: "2026-03-01T09:00:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1702, lng: 72.8311 },
    location: { block: "Surat Urban Areas" },
    source: "Times of India",
    verified: true,
    meta: { utility: "DGVCL", projectType: "Grid Upgrade" }
  },
  {
    id: "evt_GJ_surat_20260301_006",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "emergency",
    title: "Market Fire Rescues Successful",
    summary: "A fire broke out at a city market, leading to the rescue of four individuals trapped in a lift.",
    timestamp: "2026-03-01T11:20:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1850, lng: 72.8250 },
    location: { block: "Main City Market" },
    source: "Times of India",
    verified: true,
    meta: { rescued: 4, severity: "Moderate" }
  },
  {
    id: "evt_GJ_surat_20260301_007",
    stateId: "GJ",
    districtId: "surat",
    regionId: "chorasi",
    category: "mobility",
    title: "Airport Records Record Footfall",
    summary: "Surat Airport achieved its highest-ever monthly passenger traffic in February 2026.",
    timestamp: "2026-03-01T12:00:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1141, lng: 72.7425 },
    location: { block: "Magdalla (Surat Airport)" },
    source: "Times of India",
    verified: true,
    meta: { metric: "Monthly Footfall", status: "Record High" }
  },
  {
    id: "evt_GJ_surat_20260301_008",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "infrastructure",
    title: "Adajan Diaphragm Wall Damaged",
    summary: "A diaphragm wall at an ongoing construction site in Adajan sustained damage.",
    timestamp: "2026-03-01T13:45:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1925, lng: 72.7915 },
    location: { block: "Adajan Site" },
    source: "Times of India",
    verified: true,
    meta: { issue: "Structural Damage", severity: "Concern" }
  },
  {
    id: "evt_GJ_surat_20260301_009",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "safety",
    title: "iPhone Robbery Ends in Stabbing",
    summary: "A 19-year-old youth was stabbed in the neck during a violent robbery attempt in the city area.",
    timestamp: "2026-03-01T21:10:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1702, lng: 72.8311 },
    location: { block: "Surat City Area" },
    source: "Times of India",
    verified: true,
    meta: { victimAge: 19, weapon: "Knife" }
  },
  {
    id: "evt_GJ_surat_20260301_010",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "safety",
    title: "Shooting Incident at Wedding",
    summary: "A 29-year-old man was shot in the leg during a pre-wedding function in Surat City.",
    timestamp: "2026-03-01T22:30:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.1702, lng: 72.8311 },
    location: { block: "Surat City" },
    source: "Times of India",
    verified: true,
    meta: { victimAge: 29, incident: "Shooting" }
  },
  {
    id: "evt_GJ_surat_20260108_001",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "health",
    title: "Waterborne Disease Counter-Drive",
    summary: "The SMC Health Department intensified monitoring of diseases in the Udhna and Limbayat zones.",
    timestamp: "2026-01-08T10:00:00Z",
    expiresAt: "2026-02-08T10:00:00Z",
    geoPoint: { lat: 21.1743, lng: 72.8422 },
    location: { block: "Udhna and Limbayat Zones" },
    source: "Times of India",
    verified: true,
    meta: { caseType: "Typhoid", monitoringDaily: true }
  },
  {
    id: "evt_GJ_surat_20260114_002",
    stateId: "GJ",
    districtId: "surat",
    regionId: null,
    category: "mobility",
    title: "BRTS Shutdown for Uttarayan",
    summary: "All BRTS bus services were suspended to prevent kite string accidents across multiple city corridors.",
    timestamp: "2026-01-14T06:00:00Z",
    expiresAt: "2026-01-14T22:00:00Z",
    geoPoint: { lat: 21.1702, lng: 72.8311 },
    location: { block: "BRTS Corridors" },
    source: "DeshGujarat",
    verified: true,
    meta: { serviceStatus: "Suspended", reason: "Public Safety" }
  },
  {
    id: "evt_GJ_surat_20260301_011",
    stateId: "GJ",
    districtId: "surat",
    regionId: "surat-city",
    category: "safety",
    title: "Staged Crash Robbery Reported",
    summary: "Robbers staged a vehicle crash to loot Rs 35 lakh in the Rander area.",
    timestamp: "2026-03-01T15:20:00Z",
    expiresAt: null,
    geoPoint: { lat: 21.2201, lng: 72.7915 },
    location: { block: "Rander" },
    source: "Times of India",
    verified: true,
    meta: { lootAmount: 3500000, arrests: 2 }
  },
  // ── Gurugram, Haryana (Dec 2025 – Feb 2026) ───────────────────────────────
  // Source: Real events via research agent. Severity stripped per V4 schema.

  {
    id: "evt_HR_gurugram_20260131_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: "gurugram-sadar",
    category: "health",
    title: "ARI Spike — Winter Pollution Impact",
    summary: "2,293 acute respiratory illness emergencies recorded. 358 case increase over previous winter due to poor AQI.",
    timestamp: "2026-01-31T18:00:00Z",
    expiresAt: "2026-03-15T18:00:00Z",
    geoPoint: { lat: 28.4595, lng: 77.0266 },
    location: { block: "Gurugram Sadar — Civil Hospital, Medanta, Paras" },
    source: "Gurugram Health Dept / HT",
    verified: true,
    verifiedAt: "2026-01-31T23:23:00Z",
    meta: {
      caseCount: 2293,
      sentinelSites: ["Medanta", "Paras", "Civil Hospital Sector 10"],
      pollutantFocus: "PM2.5 / PM10"
    }
  },

  {
    id: "evt_HR_gurugram_20260203_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: "gurugram-sadar",
    category: "infrastructure",
    title: "Service Road Repairs — Sector 30/31",
    summary: "GMDA tenders floated for service lane upgrades and footpath repairs to reduce highway congestion.",
    timestamp: "2026-02-03T07:12:00Z",
    expiresAt: "2026-08-01T18:00:00Z",
    geoPoint: { lat: 28.4550, lng: 77.0580 },
    location: { block: "Sector 30-31, Gurugram" },
    source: "GMDA / Hindustan Times",
    verified: true,
    verifiedAt: "2026-02-03T09:00:00Z",
    meta: {
      projectLengthKm: 7.5,
      authority: "GMDA",
      scope: ["Service lane repair", "Encroachment removal"]
    }
  },

  {
    id: "evt_HR_gurugram_20260218_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: "gurugram-sadar",
    category: "mobility",
    title: "Fatal Crash — KMP Expressway",
    summary: "Dumper truck collision with tourist vehicle resulting in 2 fatalities. Significant traffic disruption reported.",
    timestamp: "2026-02-18T08:07:00Z",
    expiresAt: "2026-02-19T12:00:00Z",
    geoPoint: { lat: 28.3245, lng: 76.8521 },
    location: { block: "KMP Expressway, Gurugram-Rewari stretch" },
    source: "Gurugram Traffic Police",
    verified: true,
    verifiedAt: "2026-02-18T09:30:00Z",
    meta: {
      vehicleTypes: ["Dumper", "Sedan"],
      fatalities: 2,
      highway: "KMP Expressway"
    }
  },

  {
    id: "evt_HR_gurugram_20260222_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: "badshahpur",
    category: "safety",
    title: "Serious Assault — Badshahpur Police Area",
    summary: "19-year-old student assaulted. Accused arrested under serious criminal charges. Investigation active.",
    timestamp: "2026-02-22T13:30:00Z",
    expiresAt: null,
    geoPoint: { lat: 28.3962, lng: 77.0543 },
    location: { block: "Badshahpur, Gurugram" },
    source: "Badshahpur Police / ANI",
    verified: true,
    verifiedAt: "2026-02-22T15:00:00Z",
    meta: {
      arrestStatus: "Accused in custody",
      incidentType: "Criminal Assault",
      station: "Badshahpur"
    }
  },

  {
    id: "evt_HR_gurugram_20251214_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: null,
    category: "weather",
    impactScale: "WIDE",
    title: "Dense Fog — Massive Pile-up Advisory",
    summary: "Visibility < 50m causing multiple vehicle collisions across Haryana highways, including Gurugram sectors.",
    timestamp: "2025-12-14T12:34:00Z",
    expiresAt: "2025-12-16T12:00:00Z",
    geoPoint: { lat: 28.4595, lng: 77.0266 },
    location: { block: "District-wide highway corridors" },
    source: "IMD / Local News",
    verified: true,
    verifiedAt: "2025-12-14T13:00:00Z",
    meta: {
      visibilityMeters: 50,
      alertLevel: "orange",
      impact: "Highway pile-ups"
    }
  },

  {
    id: "evt_MH_pune_20260301_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "haveli",
    category: "emergency",
    title: "Dump Site Fire Hospitalizes Five",
    summary: "A massive fire at a garbage dump on the Mula-Mutha river bed led to the hospitalization of five students with breathing issues in Loni Kalbhor.",
    timestamp: "2026-03-01T01:36:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.4875,
      lng: 74.0194
    },
    location: {
      block: "Loni Kalbhor"
    },
    source: "The Times of India",
    verified: true,
    meta: {
      hospitalizedCount: 5,
      incidentType: "Fire",
      radiusMetres: 1500
    }
  },
  {
    id: "evt_MH_pune_20260301_002",
    stateId: "MH",
    districtId: "pune",
    regionId: null,
    category: "safety",
    title: "Propylene Tanker Overturns on Expressway",
    summary: "An inflammable gas tanker overturned near Khopoli, resulting in a 33-hour traffic halt on the Mumbai-Pune Expressway.",
    timestamp: "2026-03-01T08:00:00Z",
    expiresAt: "2026-03-02T17:00:00Z",
    geoPoint: {
      lat: 18.7881,
      lng: 73.3444
    },
    location: {
      block: "Khopoli Stretch, Expressway"
    },
    source: "Hindustan Times",
    verified: true,
    meta: {
      disruptionDurationHours: 33,
      chemical: "Propylene"
    }
  },
  {
    id: "evt_MH_pune_20260225_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "pune-city",
    category: "infrastructure",
    title: "Construction Stop Notices Issued",
    summary: "PMC issued stop-work notices to 220 construction sites for failing to implement air pollution control measures across city areas.",
    timestamp: "2026-02-25T05:04:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.5204,
      lng: 73.8567
    },
    location: {
      block: "Pune City (Various)"
    },
    source: "The Indian Express",
    verified: true,
    meta: {
      noticesIssued: 220,
      complianceRate: "87%"
    }
  },
  {
    id: "evt_MH_pune_20260224_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "haveli",
    category: "safety",
    title: "Fatal Crash Near Katraj Tunnel",
    summary: "A truck driver died and several passengers were injured after a truck carrying iron pipes collided with a bus at Katraj Ghat.",
    timestamp: "2026-02-23T22:30:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.4312,
      lng: 73.8561
    },
    location: {
      block: "Katraj Ghat (Jambhulwadi)"
    },
    source: "The Bridge Chronicle",
    verified: true,
    meta: {
      fatalities: 1,
      injured: 5
    }
  },
  {
    id: "evt_MH_pune_20260223_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "pune-city",
    category: "weather",
    title: "Second Highest February Minimum Temp",
    summary: "Shivajinagar recorded a minimum temperature of 19.2\u00b0C, the second-highest for February since 2015.",
    timestamp: "2026-02-22T23:08:00Z",
    expiresAt: "2026-02-28T18:00:00Z",
    geoPoint: {
      lat: 18.5312,
      lng: 73.8445
    },
    location: {
      block: "Shivajinagar"
    },
    source: "Hindustan Times",
    verified: true,
    meta: {
      temperatureCelsius: 19.2,
      departureFromNormal: 5.8
    }
  },
  {
    id: "evt_MH_pune_20260222_001",
    stateId: "MH",
    districtId: "pune",
    regionId: null,
    category: "health",
    title: "High Chikungunya Infection Rates",
    summary: "Pune district logged the highest chikungunya infections and second-highest dengue cases in Maharashtra for the 2025 season.",
    timestamp: "2026-02-22T08:00:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.5204,
      lng: 73.8567
    },
    location: {
      block: "Pune District"
    },
    source: "The Times of India",
    verified: true,
    meta: {
      chikungunyaCases: 22,
      dengueCases: 44
    }
  },
  {
    id: "evt_MH_pune_20260215_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "pune-city",
    category: "infrastructure",
    title: "Mula Mutha Riverfront Stretch Opened",
    summary: "The Pune Municipal Corporation opened a 1.5 km rejuvenated stretch of the riverfront in Yerawada-Kalyani Nagar.",
    timestamp: "2026-02-15T04:30:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.5362,
      lng: 73.894
    },
    location: {
      block: "Yerawada-Kalyani Nagar"
    },
    source: "Times Property",
    verified: true,
    meta: {
      stretchLengthKm: 1.5
    }
  },
  {
    id: "evt_MH_pune_20260210_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "pune-city",
    category: "infrastructure",
    title: "MHADA Lottery Results Declared",
    summary: "Results for the Pune MHADA housing lottery were officially declared for thousands of affordable units.",
    timestamp: "2026-02-10T05:00:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.5284,
      lng: 73.8744
    },
    location: {
      block: "MHADA Pune Office"
    },
    source: "Times Property",
    verified: true,
    meta: {
      event: "Lottery Draw"
    }
  },
  {
    id: "evt_MH_pune_20260204_001",
    stateId: "MH",
    districtId: "pune",
    regionId: null,
    category: "mobility",
    title: "Gas Tanker Overturns Near Tunnel",
    summary: "A gas tanker overturned near Aadoshi tunnel, causing a 50km traffic jam on the Mumbai-Pune Expressway for 20 hours.",
    timestamp: "2026-02-04T11:30:00Z",
    expiresAt: "2026-02-05T08:00:00Z",
    geoPoint: {
      lat: 18.7667,
      lng: 73.3833
    },
    location: {
      block: "Aadoshi Tunnel"
    },
    source: "News18 Marathi",
    verified: true,
    meta: {
      jamLengthKm: 50,
      blockageHours: 20
    }
  },
  {
    id: "evt_MH_pune_20260202_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "pune-city",
    category: "safety",
    title: "Three Fatalities in Road Accidents",
    summary: "Three people died in separate road accidents involving a PMPML bus and trucks in Aundh and Nagar Road.",
    timestamp: "2026-02-02T04:00:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.5135,
      lng: 73.8122
    },
    location: {
      block: "Uttamnagar, Aundh, Nagar Road"
    },
    source: "The Bridge Chronicle",
    verified: true,
    meta: {
      fatalities: 3
    }
  },
  {
    id: "evt_MH_pune_20260126_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "pune-city",
    category: "safety",
    title: "Pune Road Fatalities Surge",
    summary: "Police data reveals a crisis with 290 road deaths in the past year, primarily affecting pedestrians and bikers in Pune City.",
    timestamp: "2026-01-26T05:30:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.5204,
      lng: 73.8567
    },
    location: {
      block: "Pune City"
    },
    source: "The Bridge Chronicle",
    verified: true,
    meta: {
      annualFatalities: 290,
      seriousAccidents: 633
    }
  },
  {
    id: "evt_MH_pune_20260125_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "daund",
    category: "mobility",
    title: "High Speed Train Trials Conducted",
    summary: "High-speed train trials were successfully conducted on the Daund-Kashti section of the Pune division.",
    timestamp: "2026-01-25T07:00:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.4684,
      lng: 74.5878
    },
    location: {
      block: "Daund-Kashti Section"
    },
    source: "Times Property",
    verified: true,
    meta: {
      trialType: "High Speed"
    }
  },
  {
    id: "evt_MH_pune_20260120_001",
    stateId: "MH",
    districtId: "pune",
    regionId: null,
    category: "infrastructure",
    title: "Outer Ring Road Work Progresses",
    summary: "Major groundwork for the Pune Outer Ring Road has been completed in the Sangrun and Davaje segments.",
    timestamp: "2026-01-20T08:00:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.4233,
      lng: 73.7431
    },
    location: {
      block: "Sangrun and Davaje"
    },
    source: "Times Property",
    verified: true,
    meta: {
      project: "Outer Ring Road",
      status: "Construction Underway"
    }
  },
  {
    id: "evt_MH_pune_20260119_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "mawal",
    category: "mobility",
    title: "Talegaon Bridge Closure Alert",
    summary: "A bridge between Talegaon and Dehu Road was closed for maintenance, causing local traffic diversions.",
    timestamp: "2026-01-19T02:00:00Z",
    expiresAt: "2026-01-25T18:30:00Z",
    geoPoint: {
      lat: 18.7325,
      lng: 73.6766
    },
    location: {
      block: "Talegaon-Dehu Road"
    },
    source: "Times Property",
    verified: true,
    meta: {
      status: "Closed"
    }
  },
  {
    id: "evt_MH_pune_20260102_001",
    stateId: "MH",
    districtId: "pune",
    regionId: "haveli",
    category: "infrastructure",
    title: "Airport Infrastructure Stress Warning",
    summary: "Authorities project 10 lakh additional flyers in 2026, leading to urgent calls for expanded space at Lohegaon Airport.",
    timestamp: "2026-01-02T15:12:00Z",
    expiresAt: null,
    geoPoint: {
      lat: 18.5822,
      lng: 73.9197
    },
    location: {
      block: "Lohegaon (Pune Airport)"
    },
    source: "The Times of India",
    verified: true,
    meta: {
      projectedGrowth: "10 Lakh Flyers",
      capacityStress: true
    }
  }
];
