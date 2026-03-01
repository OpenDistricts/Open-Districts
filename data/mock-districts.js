// ─── MOCK DISTRICTS & STATES — OpenDistricts V4 ───────────────────────────────
// Schema source: docs/V4-transition-schema.md

// ── STATES ───────────────────────────────────────────────────────────────────

export const MOCK_STATES = [
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

// ── DISTRICTS ─────────────────────────────────────────────────────────────────

export const MOCK_DISTRICTS = [

    // Odisha
    {
        id: "khordha",
        stateId: "OD",
        name: "Khordha",
        nameLocal: "ଖୋର୍ଦ୍ଧା",
        geoJsonUrl: "/data/geo/OD/khordha.geojson",
        boundingBox: { north: 20.35, south: 20.01, east: 85.98, west: 85.52 },
        population: 2246341,
        dataPoints: 7
    },
    {
        id: "cuttack",
        stateId: "OD",
        name: "Cuttack",
        nameLocal: "କଟକ",
        geoJsonUrl: "/data/geo/OD/cuttack.geojson",
        boundingBox: { north: 20.62, south: 20.30, east: 86.15, west: 85.72 },
        population: 2618708,
        dataPoints: 5
    },
    {
        id: "puri",
        stateId: "OD",
        name: "Puri",
        nameLocal: "ପୁରୀ",
        geoJsonUrl: "/data/geo/OD/puri.geojson",
        boundingBox: { north: 20.12, south: 19.70, east: 86.10, west: 85.68 },
        population: 1498604,
        dataPoints: 3
    },
    {
        id: "ganjam",
        stateId: "OD",
        name: "Ganjam",
        nameLocal: "ଗଞ୍ଜାମ",
        geoJsonUrl: "/data/geo/OD/ganjam.geojson",
        boundingBox: { north: 20.18, south: 19.28, east: 85.35, west: 84.28 },
        population: 3529031,
        dataPoints: 6
    },
    {
        id: "balangir",
        stateId: "OD",
        name: "Balangir",
        nameLocal: "ବଲାଙ୍ଗୀର",
        geoJsonUrl: "/data/geo/OD/balangir.geojson",
        boundingBox: { north: 20.95, south: 20.22, east: 83.72, west: 82.73 },
        population: 1652593,
        dataPoints: 4
    },
    {
        id: "mayurbhanj",
        stateId: "OD",
        name: "Mayurbhanj",
        nameLocal: "ମୟୂରଭଞ୍ଜ",
        geoJsonUrl: "/data/geo/OD/mayurbhanj.geojson",
        boundingBox: { north: 22.3, south: 21.2, east: 86.8, west: 85.6 },
        population: 2519738,
        dataPoints: 2
    },
    {
        id: "koraput",
        stateId: "OD",
        name: "Koraput",
        nameLocal: "କୋରାପୁଟ",
        geoJsonUrl: "/data/geo/OD/koraput.geojson",
        boundingBox: { north: 19.3, south: 18.2, east: 83.2, west: 82.1 },
        population: 1379647,
        dataPoints: 5
    },
    {
        id: "sambalpur",
        stateId: "OD",
        name: "Sambalpur",
        nameLocal: "ସମ୍ବଲପୁର",
        geoJsonUrl: "/data/geo/OD/sambalpur.geojson",
        boundingBox: { north: 21.8, south: 20.7, east: 84.4, west: 83.3 },
        population: 1041099,
        dataPoints: 1
    },
    {
        id: "sundargarh",
        stateId: "OD",
        name: "Sundargarh",
        nameLocal: "ସୁନ୍ଦରଗଡ଼",
        geoJsonUrl: "/data/geo/OD/sundargarh.geojson",
        boundingBox: { north: 22.4, south: 21.6, east: 85.2, west: 83.5 },
        population: 2093437,
        dataPoints: 3
    },

    // Maharashtra
    {
        id: "pune",
        stateId: "MH",
        name: "Pune",
        nameLocal: "पुणे",
        geoJsonUrl: "/data/geo/MH/pune.geojson",
        boundingBox: { north: 19.42, south: 18.18, east: 74.60, west: 73.50 },
        population: 9429408,
        dataPoints: 5
    },
    {
        id: "mumbai",
        stateId: "MH",
        name: "Mumbai",
        nameLocal: "मुंबई",
        geoJsonUrl: "/data/geo/MH/mumbai.geojson",
        boundingBox: { north: 19.27, south: 18.89, east: 72.98, west: 72.77 },
        population: 12442373,
        dataPoints: 9
    },
    {
        id: "nagpur",
        stateId: "MH",
        name: "Nagpur",
        nameLocal: "नागपूर",
        geoJsonUrl: "/data/geo/MH/nagpur.geojson",
        boundingBox: { north: 21.45, south: 20.75, east: 79.35, west: 78.80 },
        population: 4653570,
        dataPoints: 3
    },
    {
        id: "nashik",
        stateId: "MH",
        name: "Nashik",
        nameLocal: "नाशिक",
        geoJsonUrl: "/data/geo/MH/nashik.geojson",
        boundingBox: { north: 20.85, south: 19.72, east: 74.45, west: 73.52 },
        population: 6107187,
        dataPoints: 4
    },
    {
        id: "aurangabad",
        stateId: "MH",
        name: "Aurangabad",
        nameLocal: "औरंगाबाद",
        geoJsonUrl: "/data/geo/MH/aurangabad.geojson",
        boundingBox: { north: 20.12, south: 18.85, east: 75.82, west: 74.58 },
        population: 3701282,
        dataPoints: 6
    },

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
    // Retained for historical GeoJSON compatibility (OD still in hierarchy selector)
    "khordha": [
        { id: "balianta-block", name: "Balianta Block" },
        { id: "tangi-block", name: "Tangi Block" },
        { id: "bolagarh-block", name: "Bolagarh Block" },
        { id: "jatni-block", name: "Jatni Block" },
        { id: "khordha-block", name: "Khordha Block" }
    ],
    "cuttack": [
        { id: "cuttack-sadar", name: "Cuttack Sadar" }
    ],
    "puri": [
        { id: "puri-sadar", name: "Puri Sadar" }
    ]
};
