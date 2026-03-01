import json
import os

STATE_MAPPINGS = {
    "Andaman and Nicobar": "AN",
    "Andhra Pradesh": "AP",
    "Arunachal Pradesh": "AR",
    "Assam": "AS",
    "Bihar": "BR",
    "Chandigarh": "CH",
    "Chhattisgarh": "CT",
    "Dadra and Nagar Haveli": "DN",
    "Daman and Diu": "DD",
    "Delhi": "DL",
    "Goa": "GA",
    "Gujarat": "GJ",
    "Haryana": "HR",
    "Himachal Pradesh": "HP",
    "Jammu and Kashmir": "JK",
    "Jharkhand": "JH",
    "Karnataka": "KA",
    "Kerala": "KL",
    "Lakshadweep": "LD",
    "Madhya Pradesh": "MP",
    "Maharashtra": "MH",
    "Manipur": "MN",
    "Meghalaya": "ML",
    "Mizoram": "MZ",
    "Nagaland": "NL",
    "Orissa": "OD",
    "Puducherry": "PY",
    "Punjab": "PB",
    "Rajasthan": "RJ",
    "Sikkim": "SK",
    "Tamil Nadu": "TN",
    "Tripura": "TR",
    "Uttar Pradesh": "UP",
    "Uttaranchal": "UT",
    "West Bengal": "WB"
}

# Add state name aliases if any
# e.g. 'Odisha' is mapping to OD already via Orissa in my previous simplified script, but here NAME_1 might be Orissa
REVERSE_MAPPING = {v: k for k, v in STATE_MAPPINGS.items()}

INPUT_FILE = "data/geo/india-districts-all.geojson"
OUTPUT_DIR = "data/geo/"

print("Loading comprehensive districts...")
with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Group by state name
by_state = {}
for feat in data['features']:
    sname = feat['properties'].get('NAME_1')
    if not sname: continue
    
    if sname not in by_state:
        by_state[sname] = []
    by_state[sname].append(feat)

print(f"Found {len(by_state)} states in GeoJSON.")

mock_states_data = []

for sname, features in by_state.items():
    code = STATE_MAPPINGS.get(sname)
    if not code:
        code = sname.upper().replace(" ", "_")[:3]
    
    # Save GeoJSON
    out_path = os.path.join(OUTPUT_DIR, f"{code}.geojson")
    
    # We will simply write the features
    state_fc = {
        "type": "FeatureCollection",
        "features": features
    }
    
    print(f"Writing {out_path} ({len(features)} districts)...")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(state_fc, f, separators=(',', ':'))

print("Completed partitioning!")
