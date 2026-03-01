// ─── MOCK DISTRICTS & STATES — OpenDistricts V4 ───────────────────────────────
// Schema source: docs/V4-transition-schema.md

import { MOCK_EVENTS } from "./mock-events.js";

// ── STATES ───────────────────────────────────────────────────────────────────

const _rawStates = [
    {
        id: "OD",
        name: "Odisha",
        nameLocal: "ଓଡ଼ିଶା",
        geoJsonUrl: "/data/geo/OD/state-outline.geojson",
        districts: ["khordha", "cuttack", "puri", "ganjam", "balangir", "mayurbhanj", "koraput", "sambalpur", "sundargarh"],
        dataPoints: 34
    },
    {
        id: "MH",
        name: "Maharashtra",
        nameLocal: "महाराष्ट्र",
        geoJsonUrl: "/data/geo/MH/state-outline.geojson",
        districts: ["pune", "mumbai", "nagpur", "nashik", "aurangabad"],
        dataPoints: 21
    },
    {
        id: "TN",
        name: "Tamil Nadu",
        nameLocal: "தமிழ் நாடு",
        geoJsonUrl: "/data/geo/TN/state-outline.geojson",
        districts: ["chennai", "coimbatore", "madurai", "tiruchirappalli", "salem"],
        dataPoints: 15
    },
    {
        id: "KA",
        name: "Karnataka",
        nameLocal: "ಕರ್ನಾಟಕ",
        geoJsonUrl: "/data/geo/KA/state-outline.geojson",
        districts: ["bengaluru-urban", "mysuru", "dharwad", "belagavi", "tumakuru"],
        dataPoints: 9
    },
    {
        id: "WB",
        name: "West Bengal",
        nameLocal: "পশ্চিমবঙ্গ",
        geoJsonUrl: "/data/geo/WB/state-outline.geojson",
        districts: ["kolkata", "howrah", "darjeeling", "purba-medinipur", "murshidabad"],
        dataPoints: 18
    },
    {
        id: "GJ",
        name: "Gujarat",
        nameLocal: "ગુજરાત",
        geoJsonUrl: "/data/geo/GJ/state-outline.geojson",
        districts: ["surat"],
        dataPoints: 15
    },
    {
        id: "UP",
        name: "Uttar Pradesh",
        nameLocal: "उत्तर प्रदेश",
        geoJsonUrl: "/data/geo/UP/state-outline.geojson",
        districts: ["lucknow", "kanpur", "agra", "varanasi", "prayagraj"],
        dataPoints: 41
    },
    {
        id: "RJ",
        name: "Rajasthan",
        nameLocal: "राजस्थान",
        geoJsonUrl: "/data/geo/RJ/state-outline.geojson",
        districts: ["jaipur", "jodhpur", "udaipur", "kota", "bikaner"],
        dataPoints: 12
    },
    {
        id: "MP",
        name: "Madhya Pradesh",
        nameLocal: "मध्य प्रदेश",
        geoJsonUrl: "/data/geo/MP/state-outline.geojson",
        districts: ["bhopal", "indore", "gwalior", "jabalpur", "ujjain"],
        dataPoints: 17
    },
    { id: "AN", name: "Andaman and Nicobar", nameLocal: "అండమాన్ మరియు నికోబార్", geoJsonUrl: "/data/geo/AN/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "AP", name: "Andhra Pradesh", nameLocal: "ఆంధ్రప్రదేశ్", geoJsonUrl: "/data/geo/AP/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "AR", name: "Arunachal Pradesh", nameLocal: "అరుణాచల్ ప్రదేశ్", geoJsonUrl: "/data/geo/AR/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "AS", name: "Assam", nameLocal: "అసోం", geoJsonUrl: "/data/geo/AS/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "BR", name: "Bihar", nameLocal: "बिहार", geoJsonUrl: "/data/geo/BR/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "CH", name: "Chandigarh", nameLocal: "चंडीगढ़", geoJsonUrl: "/data/geo/CH/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "CT", name: "Chhattisgarh", nameLocal: "छत्तीसगढ़", geoJsonUrl: "/data/geo/CT/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "DN", name: "Dadra and Nagar Haveli", nameLocal: "दादरा और नगर हवेली", geoJsonUrl: "/data/geo/DN/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "DD", name: "Daman and Diu", nameLocal: "दमन और दीव", geoJsonUrl: "/data/geo/DD/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "DL", name: "Delhi", nameLocal: "दिल्ली", geoJsonUrl: "/data/geo/DL/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "GA", name: "Goa", nameLocal: "गोवा", geoJsonUrl: "/data/geo/GA/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "HR", name: "Haryana", nameLocal: "हरियाणा", geoJsonUrl: "/data/geo/HR/state-outline.geojson", districts: ["gurugram"], dataPoints: 5 },
    { id: "HP", name: "Himachal Pradesh", nameLocal: "हिमाचल प्रदेश", geoJsonUrl: "/data/geo/HP/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "JK", name: "Jammu and Kashmir", nameLocal: "जम्मू और कश्मीर", geoJsonUrl: "/data/geo/JK/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "JH", name: "Jharkhand", nameLocal: "झारखंड", geoJsonUrl: "/data/geo/JH/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "KL", name: "Kerala", nameLocal: "കേരളം", geoJsonUrl: "/data/geo/KL/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "LD", name: "Lakshadweep", nameLocal: "ലക്ഷദ്വീപ്", geoJsonUrl: "/data/geo/LD/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "MN", name: "Manipur", nameLocal: "मणिपुर", geoJsonUrl: "/data/geo/MN/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "ML", name: "Meghalaya", nameLocal: "मेघालय", geoJsonUrl: "/data/geo/ML/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "MZ", name: "Mizoram", nameLocal: "मिज़ोरम", geoJsonUrl: "/data/geo/MZ/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "NL", name: "Nagaland", nameLocal: "नागालैंड", geoJsonUrl: "/data/geo/NL/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "PY", name: "Puducherry", nameLocal: "पुदुच्चेरी", geoJsonUrl: "/data/geo/PY/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "PB", name: "Punjab", nameLocal: "पंजाब", geoJsonUrl: "/data/geo/PB/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "SK", name: "Sikkim", nameLocal: "सिक्किम", geoJsonUrl: "/data/geo/SK/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "TR", name: "Tripura", nameLocal: "త్రిపుర", geoJsonUrl: "/data/geo/TR/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "TS", name: "Telangana", nameLocal: "తెలంగాణ", geoJsonUrl: "/data/geo/TS/state-outline.geojson", districts: [], dataPoints: 0 },
    { id: "UT", name: "Uttaranchal", nameLocal: "उत्तरांचल", geoJsonUrl: "/data/geo/UT/state-outline.geojson", districts: [], dataPoints: 0 }
];

export const MOCK_STATES = _rawStates.map(state => ({
    ...state,
    dataPoints: MOCK_EVENTS.filter(e => e.stateId === state.id).length
}));

// ── DISTRICTS ─────────────────────────────────────────────────────────────────

const _rawDistricts = [

    // Haryana
    {
        id: "gurugram",
        stateId: "HR",
        name: "Gurugram",
        aliases: ["Gurgaon"],
        nameLocal: "गुरुग्राम",
        geoJsonUrl: "/data/geo/HR/gurugram.geojson",
        boundingBox: { north: 28.55, south: 28.22, east: 77.20, west: 76.75 },
        population: 1514432,
        dataPoints: 5
    },

    // Gujarat
    {
        id: "surat",
        stateId: "GJ",
        name: "Surat",
        nameLocal: "સુરત",
        geoJsonUrl: "/data/geo/GJ/surat.geojson",
        boundingBox: { north: 21.43, south: 21.05, east: 73.20, west: 72.63 },
        population: 6081322,
        dataPoints: 15
    }
];

export const MOCK_DISTRICTS = _rawDistricts.map(dist => ({
    ...dist,
    dataPoints: MOCK_EVENTS.filter(e => e.districtId === dist.id).length
}));

// ── SUB-DISTRICT REGIONS (for GeoJSON regionId binding) ───────────────────────
// Used by geo-service to map regionId slugs to display names

export const MOCK_REGIONS = {
    // Gurugram tehsils
    "gurugram": [
        { id: "gurugram-sadar", name: "Gurugram Sadar" },
        { id: "badshahpur", name: "Badshahpur" },
        { id: "pataudi", name: "Pataudi" },
        { id: "manesar", name: "Manesar" },
        { id: "farrukhnagar", name: "Farrukhnagar" },
        { id: "sohna", name: "Sohna" }
    ],
    // Surat tehsils
    "surat": [
        { id: "surat-city", name: "Surat City" },
        { id: "chorasi", name: "Choryasi" },
        { id: "olpad", name: "Olpad" },
        { id: "bardoli", name: "Bardoli" },
        { id: "kamrej", name: "Kamrej" },
        { id: "palsana", name: "Palsana" }
    ]
};
