import json
import math
import os
import shutil

# --- Configuration ---
DATAMEET_DISTRICTS = "data/geo/india-districts-all.geojson"
SUB_DISTRICTS = "INDIAN-SHAPEFILES/INDIA/INDIAN_SUB_DISTRICTS.geojson"
OUT_DIR = "data/geo"

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
    "Odisha": "OD",
    "Puducherry": "PY",
    "Punjab": "PB",
    "Rajasthan": "RJ",
    "Sikkim": "SK",
    "Tamil Nadu": "TN",
    "Telangana": "TS", # Or TG
    "Tripura": "TR",
    "Uttar Pradesh": "UP",
    "Uttaranchal": "UT",
    "Uttarakhand": "UT",
    "West Bengal": "WB"
}

# --- Simplification Logic ---
def point_line_distance(p, a, b):
    if a == b: return math.hypot(p[0] - a[0], p[1] - a[1])
    n = abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0])
    d = math.hypot(b[0] - a[0], b[1] - a[1])
    return n / d if d != 0 else 0

def douglas_peucker(points, epsilon):
    if len(points) < 3: return points
    dmax = 0
    index = 0
    end = len(points) - 1
    for i in range(1, end):
        d = point_line_distance(points[i], points[0], points[end])
        if d > dmax:
            index = i
            dmax = d
    if dmax > epsilon:
        left = douglas_peucker(points[:index+1], epsilon)
        right = douglas_peucker(points[index:], epsilon)
        return left[:-1] + right
    else: return [points[0], points[-1]]

def simplify_polygon(polygon, epsilon):
    return [douglas_peucker(ring, epsilon) for ring in polygon]

def simplify_geometry(geom, epsilon):
    if geom['type'] == 'Polygon':
        geom['coordinates'] = simplify_polygon(geom['coordinates'], epsilon)
    elif geom['type'] == 'MultiPolygon':
        geom['coordinates'] = [simplify_polygon(poly, epsilon) for poly in geom['coordinates']]
    def round_coords(coords):
        if isinstance(coords[0], list): return [round_coords(c) for c in coords]
        return [round(coords[0], 4), round(coords[1], 4)]
    geom['coordinates'] = round_coords(geom['coordinates'])
    return geom

# --- Phase 1: State files containing Districts ---
print("--- Phase 1: Processing Datameet Districts (State Maps) ---")
with open(DATAMEET_DISTRICTS, "r", encoding="utf-8") as f:
    india_districts = json.load(f)

by_state = {}
for feat in india_districts['features']:
    props = feat['properties']
    sname = props.get('ST_NM', props.get('NAME_1'))
    if not sname: continue
    
    # Normalize state name
    sname = sname.title().replace("&", "and")
    if sname == "Andaman & Nicobar Island": sname = "Andaman and Nicobar"
    if sname == "Dadara & Nagar Havelli": sname = "Dadra and Nagar Haveli"
    if sname == "Daman & Diu": sname = "Daman and Diu"
    if sname == "Nct Of Delhi": sname = "Delhi"
    if sname == "Orissa": sname = "Odisha"
    if sname == "Jammu & Kashmir": sname = "Jammu and Kashmir"

    code = STATE_MAPPINGS.get(sname)
    if not code:
        code = sname.upper().replace(" ", "_")[:2]
    
    if code not in by_state: by_state[code] = []
    
    # Simplify and store
    new_feat = {
        "type": "Feature",
        "properties": {
            "name": props.get('DISTRICT', props.get('NAME_2', 'Unknown')),
            "id": props.get('DISTRICT', props.get('NAME_2', 'unknown')).lower().replace(" ", "-"),
            "stateId": code
        },
        "geometry": simplify_geometry(feat['geometry'], 0.005) # Aggressive simplify for state scale
    }
    by_state[code].append(new_feat)

os.makedirs(OUT_DIR, exist_ok=True)
for code, features in by_state.items():
    out_path = os.path.join(OUT_DIR, f"{code}.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, separators=(',', ':'))

# --- Phase 2: District files containing Sub-districts ---
print("--- Phase 2: Processing Datta07 Sub-Districts (District Maps) ---")
with open(SUB_DISTRICTS, "r", encoding="utf-8") as f:
    sub_districts = json.load(f)

by_district = {}
for feat in sub_districts['features']:
    props = feat['properties']
    sname = props.get('stname', '').title().replace("&", "and")
    if sname == "Orissa": sname = "Odisha"
    code = STATE_MAPPINGS.get(sname)
    if not code: continue # Skip if unmapped state
    
    dtname = props.get('dtname', '').lower().strip()
    if not dtname: continue
    sdtname = props.get('sdtname', '').lower().strip()
    
    # Use normalized IDs
    dist_slug = dtname.replace(" ", "-")
    sub_slug = sdtname.replace(" ", "-")
    
    if code not in by_district: by_district[code] = {}
    if dist_slug not in by_district[code]: by_district[code][dist_slug] = []
    
    new_feat = {
        "type": "Feature",
        "properties": {
            "id": sub_slug,
            "name": sdtname.title(),
            "districtId": dist_slug
        },
        "geometry": simplify_geometry(feat['geometry'], 0.002) # finer simplification since we are zoomed in
    }
    by_district[code][dist_slug].append(new_feat)

for code, dicts in by_district.items():
    state_dir = os.path.join(OUT_DIR, code)
    os.makedirs(state_dir, exist_ok=True)
    for dist_slug, features in dicts.items():
        out_path = os.path.join(state_dir, f"{dist_slug}.geojson")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": features}, f, separators=(',', ':'))

print("Completed processing all GeoJSON files!")
