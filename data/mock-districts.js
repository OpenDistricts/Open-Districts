// ─── MOCK DISTRICTS & STATES - OpenDistricts V4 ───────────────────────────────
// Schema source: docs/V4-transition-schema.md

import { MOCK_EVENTS } from "./mock-events.js";

// ── STATES ───────────────────────────────────────────────────────────────────

const _rawStates = [
    {
        id: "OD",
        name: "Odisha",
        nameLocal: "ଓଡ଼ିଶା",
        geoJsonUrl: "./data/geo/OD/state-outline.geojson?v=2",
        districts: ["khordha", "cuttack", "puri", "ganjam", "balangir", "mayurbhanj", "koraput", "sambalpur", "sundargarh"],
        dataPoints: 34
    },
    {
        id: "MH",
        name: "Maharashtra",
        nameLocal: "महाराष्ट्र",
        geoJsonUrl: "./data/geo/MH/state-outline.geojson?v=2",
        districts: ["pune", "mumbai", "nagpur", "nashik", "aurangabad"],
        dataPoints: 21
    },
    {
        id: "TN",
        name: "Tamil Nadu",
        nameLocal: "தமிழ் நாடு",
        geoJsonUrl: "./data/geo/TN/state-outline.geojson?v=2",
        districts: ["chennai", "coimbatore", "madurai", "tiruchirappalli", "salem"],
        dataPoints: 18
    },
    {
        id: "KA",
        name: "Karnataka",
        nameLocal: "ಕರ್ನಾಟಕ",
        geoJsonUrl: "./data/geo/KA/state-outline.geojson?v=2",
        districts: ["bengaluru-urban", "mysuru", "dharwad", "belagavi", "tumakuru"],
        dataPoints: 14
    },
    {
        id: "WB",
        name: "West Bengal",
        nameLocal: "পশ্চিমবঙ্গ",
        geoJsonUrl: "./data/geo/WB/state-outline.geojson?v=2",
        districts: ["kolkata", "howrah", "darjeeling", "purba-medinipur", "murshidabad"],
        dataPoints: 22
    },
    {
        id: "GJ",
        name: "Gujarat",
        nameLocal: "ગુજરાત",
        geoJsonUrl: "./data/geo/GJ/state-outline.geojson?v=2",
        districts: ["surat"],
        dataPoints: 15
    },
    {
        id: "UP",
        name: "Uttar Pradesh",
        nameLocal: "उत्तर प्रदेश",
        geoJsonUrl: "./data/geo/UP/state-outline.geojson?v=2",
        districts: ["lucknow", "kanpur", "agra", "varanasi", "prayagraj"],
        dataPoints: 46
    },
    {
        id: "RJ",
        name: "Rajasthan",
        nameLocal: "राजस्थान",
        geoJsonUrl: "./data/geo/RJ/state-outline.geojson?v=2",
        districts: ["jaipur", "jodhpur", "udaipur", "kota", "bikaner"],
        dataPoints: 12
    },
    {
        id: "MP",
        name: "Madhya Pradesh",
        nameLocal: "मध्य प्रदेश",
        geoJsonUrl: "./data/geo/MP/state-outline.geojson?v=2",
        districts: ["bhopal", "indore", "gwalior", "jabalpur", "ujjain"],
        dataPoints: 17
    },
    { id: "AN", name: "Andaman and Nicobar", nameLocal: "అండమాన్ మరియు నికోబార్", geoJsonUrl: "./data/geo/AN/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "AP", name: "Andhra Pradesh", nameLocal: "ఆంధ్రప్రదేశ్", geoJsonUrl: "./data/geo/AP/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "AR", name: "Arunachal Pradesh", nameLocal: "అరుణాచల్ ప్రదేశ్", geoJsonUrl: "./data/geo/AR/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "AS", name: "Assam", nameLocal: "అసోం", geoJsonUrl: "./data/geo/AS/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "BR", name: "Bihar", nameLocal: "बिहार", geoJsonUrl: "./data/geo/BR/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "CH", name: "Chandigarh", nameLocal: "चंडीगढ़", geoJsonUrl: "./data/geo/CH/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "CT", name: "Chhattisgarh", nameLocal: "छत्तीसगढ़", geoJsonUrl: "./data/geo/CT/state-outline.geojson?v=2", districts: [], dataPoints: 3 },
    { id: "DN", name: "Dadra and Nagar Haveli", nameLocal: "दादरा और नगर हवेली", geoJsonUrl: "./data/geo/DN/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "DD", name: "Daman and Diu", nameLocal: "दमन और दीव", geoJsonUrl: "./data/geo/DD/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "DL", name: "Delhi", nameLocal: "दिल्ली", geoJsonUrl: "./data/geo/DL/state-outline.geojson?v=2", districts: ["central", "east", "new_delhi", "north", "north_east", "north_west", "shahdara", "south", "south_east", "south_west", "west"], dataPoints: 0 },
    { id: "GA", name: "Goa", nameLocal: "गोवा", geoJsonUrl: "./data/geo/GA/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "HR", name: "Haryana", nameLocal: "हरियाणा", geoJsonUrl: "./data/geo/HR/state-outline.geojson?v=2", districts: ["gurugram"], dataPoints: 5 },
    { id: "HP", name: "Himachal Pradesh", nameLocal: "हिमाचल प्रदेश", geoJsonUrl: "./data/geo/HP/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "JK", name: "Jammu and Kashmir", nameLocal: "जम्मू और कश्मीर", geoJsonUrl: "./data/geo/JK/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "JH", name: "Jharkhand", nameLocal: "झारखंड", geoJsonUrl: "./data/geo/JH/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "KL", name: "Kerala", nameLocal: "കേരളം", geoJsonUrl: "./data/geo/KL/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "LD", name: "Lakshadweep", nameLocal: "ലക്ഷദ്വീപ്", geoJsonUrl: "./data/geo/LD/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "MN", name: "Manipur", nameLocal: "मणिपुर", geoJsonUrl: "./data/geo/MN/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "ML", name: "Meghalaya", nameLocal: "मेघालय", geoJsonUrl: "./data/geo/ML/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "MZ", name: "Mizoram", nameLocal: "मिज़ोरम", geoJsonUrl: "./data/geo/MZ/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "NL", name: "Nagaland", nameLocal: "नागालैंड", geoJsonUrl: "./data/geo/NL/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "PY", name: "Puducherry", nameLocal: "पुदुच्चेरी", geoJsonUrl: "./data/geo/PY/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "PB", name: "Punjab", nameLocal: "पंजाब", geoJsonUrl: "./data/geo/PB/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "SK", name: "Sikkim", nameLocal: "सिक्किम", geoJsonUrl: "./data/geo/SK/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "TR", name: "Tripura", nameLocal: "త్రిపుర", geoJsonUrl: "./data/geo/TR/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "TS", name: "Telangana", nameLocal: "తెలంగాణ", geoJsonUrl: "./data/geo/TS/state-outline.geojson?v=2", districts: [], dataPoints: 0 },
    { id: "UT", name: "Uttaranchal", nameLocal: "उत्तरांचल", geoJsonUrl: "./data/geo/UT/state-outline.geojson?v=2", districts: [], dataPoints: 0 }
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
        geoJsonUrl: "./data/geo/HR/gurugram.geojson?v=2",
        boundingBox: { north: 28.37909, south: 28.2239, east: 76.83812, west: 76.65111 },
        population: 1514432,
        dataPoints: 5
    },

    // Gujarat
    {
        id: "surat",
        stateId: "GJ",
        name: "Surat",
        nameLocal: "સુરત",
        geoJsonUrl: "./data/geo/GJ/surat.geojson?v=2",
        boundingBox: { north: 21.4747, south: 21.203, east: 72.9505, west: 72.5976 },
        population: 6081322,
        dataPoints: 15
    },
    {
        id: "pune",
        stateId: "MH",
        name: "Pune",
        nameLocal: "",
        geoJsonUrl: "./data/geo/MH/pune.geojson?v=2",
        boundingBox: { north: 19.3952, south: 19.0044, east: 74.3111, west: 73.6302 },
        population: 9429408
    },
    // Punjab
    {
        id: "jalandhar",
        stateId: "PB",
        name: "Jalandhar",
        nameLocal: "ਜਲੰਧਰ",
        geoJsonUrl: "./data/geo/PB/jalandhar.geojson?v=2",
        boundingBox: { north: 31.232, south: 30.9879, east: 75.4282, west: 75.0771 },
        population: 2193590,
        dataPoints: 8
    },
    // Madhya Pradesh
    {
        id: "ujjain",
        stateId: "MP",
        name: "Ujjain",
        nameLocal: "उज्जैन",
        geoJsonUrl: "./data/geo/MP/ujjain.geojson?v=2",
        boundingBox: { north: 23.6228, south: 23.2833, east: 75.4503, west: 75.1346 },
        population: 1986864,
        dataPoints: 7
    },
    // Odisha
    {
        id: "khordha",
        stateId: "OD",
        name: "Khordha",
        nameLocal: "ଖୋର୍ଦ୍ଧା",
        geoJsonUrl: "./data/geo/OD/khordha.geojson?v=2",
        boundingBox: { north: 20.2796, south: 20.1159, east: 85.3891, west: 85.1992 },
        population: 2251673,
        dataPoints: 9
    },
    // Bihar
    {
        id: "gaya",
        stateId: "BR",
        name: "Gaya",
        nameLocal: "गया",
        geoJsonUrl: "./data/geo/BR/gaya.geojson?v=2",
        boundingBox: { north: 25.0591, south: 24.8197, east: 84.855, west: 84.6413 },
        population: 4391418,
        dataPoints: 11
    },

    // Uttar Pradesh - Batch 2
    {
        id: "sitapur",
        stateId: "UP",
        name: "Sitapur",
        nameLocal: "सीतापुर",
        geoJsonUrl: "./data/geo/UP/sitapur.geojson?v=2",
        boundingBox: { north: 27.8104, south: 27.2551, east: 80.8005, west: 80.299 },
        population: 4483992
    },
    // Karnataka - Batch 2
    {
        id: "mysuru",
        stateId: "KA",
        name: "Mysuru",
        nameLocal: "ಮೈಸೂರು",
        geoJsonUrl: "./data/geo/KA/mysuru.geojson?v=2",
        boundingBox: { north: 12.577, south: 12.1878, east: 76.2395, west: 75.9087 },
        population: 3001127
    },
    // West Bengal - Batch 2
    {
        id: "hugli",
        stateId: "WB",
        name: "Hugli",
        nameLocal: "হুগলী",
        geoJsonUrl: "./data/geo/WB/hugli.geojson?v=2",
        boundingBox: { north: 22.9724, south: 22.7743, east: 87.7894, west: 87.6605 },
        population: 5519145
    },
    // Chhattisgarh - Batch 2
    {
        id: "raipur",
        stateId: "CT",
        name: "Raipur",
        nameLocal: "रायपुर",
        geoJsonUrl: "./data/geo/CT.geojson?v=2",
        boundingBox: { north: 21.6, south: 20.95, east: 82, west: 81.5 },
        population: 4063872
    },
    // Tamil Nadu - Batch 2
    {
        id: "vellore",
        stateId: "TN",
        name: "Vellore",
        nameLocal: "வேலூர்",
        geoJsonUrl: "./data/geo/TN.geojson?v=2",
        boundingBox: { north: 13.1, south: 12.55, east: 79.6, west: 78.5 },
        population: 3936331
    },


    {
        id: "new_delhi",
        stateId: "DL",
        name: "New Delhi",
        nameLocal: "नई दिल्ली",
        geoJsonUrl: "./data/geo/DL/new_delhi.geojson?v=2",
        boundingBox: { north: 28.6456842, south: 28.4812209, east: 77.2551392, west: 77.0503708 },
        population: 142004
    },
    {
        id: "central",
        stateId: "DL",
        name: "Central",
        nameLocal: "मध्य दिल्ली",
        geoJsonUrl: "./data/geo/DL/central.geojson?v=2",
        boundingBox: { north: 28.7861601, south: 28.612357, east: 77.2642707, west: 77.1651635 },
        population: 582320
    },
    {
        id: "east",
        stateId: "DL",
        name: "East",
        nameLocal: "पूर्वी दिल्ली",
        geoJsonUrl: "./data/geo/DL/east.geojson?v=2",
        boundingBox: { north: 28.6558204, south: 28.5695146, east: 77.3420594, west: 77.2525549 },
        population: 1709346
    },
    {
        id: "north",
        stateId: "DL",
        name: "North",
        nameLocal: "उत्तरी दिल्ली",
        geoJsonUrl: "./data/geo/DL/north.geojson?v=2",
        boundingBox: { north: 28.8834464, south: 28.6909168, east: 77.2236692, west: 76.9617014 },
        population: 887978
    },
    {
        id: "north_east",
        stateId: "DL",
        name: "North East",
        nameLocal: "उत्तर-पूर्वी दिल्ली",
        geoJsonUrl: "./data/geo/DL/north_east.geojson?v=2",
        boundingBox: { north: 28.7866961, south: 28.6602286, east: 77.2990534, west: 77.2062264 },
        population: 2241624
    },
    {
        id: "north_west",
        stateId: "DL",
        name: "North West",
        nameLocal: "उत्तर-पश्चिमी दिल्ली",
        geoJsonUrl: "./data/geo/DL/north_west.geojson?v=2",
        boundingBox: { north: 28.8182528, south: 28.6575238, east: 77.1896579, west: 76.9418975 },
        population: 3645184
    },
    {
        id: "shahdara",
        stateId: "DL",
        name: "Shahdara",
        nameLocal: "शाहदरा",
        geoJsonUrl: "./data/geo/DL/shahdara.geojson?v=2",
        boundingBox: { north: 28.7141043, south: 28.6377479, east: 77.3329522, west: 77.254148 },
        population: 322931
    },
    {
        id: "south",
        stateId: "DL",
        name: "South",
        nameLocal: "दक्षिणी दिल्ली",
        geoJsonUrl: "./data/geo/DL/south.geojson?v=2",
        boundingBox: { north: 28.5659457, south: 28.4046285, east: 77.248358, west: 77.1124725 },
        population: 2731929
    },
    {
        id: "south_east",
        stateId: "DL",
        name: "South East",
        nameLocal: "दक्षिण-पूर्वी दिल्ली",
        geoJsonUrl: "./data/geo/DL/south_east.geojson?v=2",
        boundingBox: { north: 28.6098577, south: 28.4797533, east: 77.3452524, west: 77.1988383 },
        population: 1500636
    },
    {
        id: "south_west",
        stateId: "DL",
        name: "South West",
        nameLocal: "दक्षिण-पश्चिमी दिल्ली",
        geoJsonUrl: "./data/geo/DL/south_west.geojson?v=2",
        boundingBox: { north: 28.6716072, south: 28.5008314, east: 77.1025691, west: 76.8388351 },
        population: 2292958
    },
    {
        id: "west",
        stateId: "DL",
        name: "West",
        nameLocal: "पश्चिमी दिल्ली",
        geoJsonUrl: "./data/geo/DL/west.geojson?v=2",
        boundingBox: { north: 28.700791, south: 28.608213, east: 77.1969405, west: 76.9506701 },
        population: 2543243
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
    ],
    pune: [
        {
            id: "pune-city",
            name: "Pune City"
        },
        {
            id: "haveli",
            name: "Haveli"
        },
        {
            id: "mawal",
            name: "Mawal"
        },
        {
            id: "mulshi",
            name: "Mulshi"
        },
        {
            id: "daund",
            name: "Daund"
        },
        {
            id: "shirur",
            name: "Shirur"
        },
        {
            id: "khed",
            name: "Khed"
        }
    ],
    // Delhi 2026 regions
    "central": [
        { id: "civil-lines", name: "Civil Lines" },
        { id: "darya-ganj", name: "Darya Ganj" },
        { id: "karol-bagh", name: "Karol Bagh" },
        { id: "kotwali", name: "Kotwali" },
        { id: "pahar-ganj", name: "Pahar Ganj" },
        { id: "sadar-bazar", name: "Sadar Bazar" }
    ],
    "east": [
        { id: "gandhi-nagar", name: "Gandhi Nagar" },
        { id: "preet-vihar", name: "Preet Vihar" }
    ],
    "new_delhi": [
        { id: "new-delhi", name: "New Delhi" },
        { id: "delhi-cantonment", name: "Delhi Cantonment" }
    ],
    "north": [
        { id: "model-town", name: "Model Town" },
        { id: "narela", name: "Narela" }
    ],
    "north_east": [
        { id: "seelam-pur", name: "Seelam Pur" }
    ],
    "north_west": [
        { id: "saraswati-vihar", name: "Saraswati Vihar" }
    ],
    "shahdara": [
        { id: "seema-puri", name: "Seema Puri" },
        { id: "shahdara", name: "Shahdara" },
        { id: "vivek-vihar", name: "Vivek Vihar" }
    ],
    "south": [
        { id: "hauz-khas", name: "Hauz Khas" }
    ],
    "south_east": [
        { id: "defence-colony", name: "Defence Colony" },
        { id: "kalkaji", name: "Kalkaji" }
    ],
    "south_west": [
        { id: "najafgarh", name: "Najafgarh" }
    ],
    "west": [
        { id: "patel-nagar", name: "Patel Nagar" },
        { id: "punjabi-bagh", name: "Punjabi Bagh" },
        { id: "rajouri-garden", name: "Rajouri Garden" }
    ],
    // New Districts
    "jaipur": [
        { id: "jaipur", name: "Jaipur" },
        { id: "sanganer", name: "Sanganer" },
        { id: "amber", name: "Amber" },
        { id: "chomu", name: "Chomu" }
    ],
    "jalandhar": [
        { id: "jalandhar-i", name: "Jalandhar I" },
        { id: "jalandhar-ii", name: "Jalandhar II" },
        { id: "nakodar", name: "Nakodar" }
    ],
    "ujjain": [
        { id: "ujjain-urban", name: "Ujjain Urban" },
        { id: "tarana", name: "Tarana" },
        { id: "nagda", name: "Nagda" }
    ],
    "khordha": [
        { id: "bhubaneswar", name: "Bhubaneswar" },
        { id: "jatni", name: "Jatni" },
        { id: "khordha", name: "Khordha" }
    ],
    "gaya": [
        { id: "gaya-sadar", name: "Gaya Sadar" },
        { id: "bodhgaya", name: "Bodh Gaya" },
        { id: "sherghati", name: "Sherghati" }
    ],
    "sitapur": [
        { id: "sadar-sitapur", name: "Sitapur Sadar" },
        { id: "misrikh", name: "Misrikh" },
        { id: "sidhauli", name: "Sidhauli" },
        { id: "mahmudabad", name: "Mahmudabad" },
        { id: "biswan", name: "Biswan" },
        { id: "laharpur", name: "Laharpur" }
    ],
    "mysuru": [
        { id: "mysuru-urban", name: "Mysuru Urban" },
        { id: "nanjangud", name: "Nanjangud" },
        { id: "hunsur", name: "Hunsur" },
        { id: "kr-nagara", name: "K.R. Nagara" },
        { id: "t-narasipura", name: "T. Narasipura" },
        { id: "periyapatna", name: "Periyapatna" }
    ],
    "hugli": [
        { id: "chinsurah", name: "Chinsurah" },
        { id: "chandannagar", name: "Chandannagar" },
        { id: "serampore", name: "Serampore" },
        { id: "tarakeswar", name: "Tarakeswar" },
        { id: "arambagh", name: "Arambagh" },
        { id: "pandua", name: "Pandua" }
    ],
    "raipur": [
        { id: "raipur", name: "Raipur City" },
        { id: "naya-raipur", name: "Naya Raipur" },
        { id: "tilda-neora", name: "Tilda Neora" },
        { id: "abhanpur", name: "Abhanpur" },
        { id: "arany", name: "Arang" }
    ],
    "vellore": [
        { id: "vellore", name: "Vellore City" },
        { id: "gudiyatham", name: "Gudiyatham" },
        { id: "vaniyambadi", name: "Vaniyambadi" },
        { id: "ambur", name: "Ambur" },
        { id: "arcot", name: "Arcot" }
    ]
};
