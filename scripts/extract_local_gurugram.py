import json
import math

def point_line_distance(p, a, b):
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    n = abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0])
    d = math.hypot(b[0] - a[0], b[1] - a[1])
    return n / d if d != 0 else 0

def douglas_peucker(points, epsilon):
    if len(points) < 3:
        return points
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
    else:
        return [points[0], points[-1]]

def simplify_polygon(polygon, epsilon=0.002):
    return [douglas_peucker(ring, epsilon) for ring in polygon]

def simplify_geometry(geom, epsilon=0.002):
    if geom['type'] == 'Polygon':
        geom['coordinates'] = simplify_polygon(geom['coordinates'], epsilon)
    elif geom['type'] == 'MultiPolygon':
        geom['coordinates'] = [simplify_polygon(poly, epsilon) for poly in geom['coordinates']]
    def round_coords(coords):
        if isinstance(coords[0], list):
            return [round_coords(c) for c in coords]
        return [round(coords[0], 5), round(coords[1], 5)]
    geom['coordinates'] = round_coords(geom['coordinates'])
    return geom

FILE_PATH = "INDIAN-SHAPEFILES/INDIA/INDIAN_SUB_DISTRICTS.geojson"

print("Parsing boundaries and extracting Gurugram tehsils from local clone...")

with open(FILE_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

gurugram_features = []

# MOCK_REGIONS IDs: gurugram-sadar, badshahpur, pataudi, manesar, farrukhnagar, sohna
NAME_MAP = {
    "gurgaon": "gurugram-sadar",
    "badshahpur": "badshahpur",
    "pataudi": "pataudi",
    "manesar": "manesar",
    "farukh nagar": "farrukhnagar",  # checking common spellings
    "farrukhnagar": "farrukhnagar",
    "sohna": "sohna"
}

for feat in data['features']:
    props = feat['properties']
    dist_name = props.get('dtname', '').lower()
    sub_dist_name = props.get('sdtname', '').lower().strip()
    
    if dist_name == 'gurgaon':
        our_id = NAME_MAP.get(sub_dist_name)
        if our_id:
            print(f"    Found real map boundaries for {sub_dist_name} -> {our_id}")
            new_feat = {
                "type": "Feature",
                "properties": {
                    "id": our_id,
                    "name": sub_dist_name.title(),
                    "districtId": "gurugram"
                },
                "geometry": simplify_geometry(feat['geometry'], 0.002)
            }
            gurugram_features.append(new_feat)
        else:
            print(f"    Missing mapping for subdistrict: {sub_dist_name}")

out_data = {
    "type": "FeatureCollection",
    "features": gurugram_features
}

out_path = "data/geo/HR/gurugram.geojson"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out_data, f, separators=(',', ':'))

print(f"Successfully injected authentic bounding data to {out_path}.")
