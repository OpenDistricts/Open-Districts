import json
import urllib.request
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

def simplify_polygon(polygon, epsilon=0.005): # Less aggressive epsilon for district level
    return [douglas_peucker(ring, epsilon) for ring in polygon]

def simplify_geometry(geom, epsilon=0.005):
    if geom['type'] == 'Polygon':
        geom['coordinates'] = simplify_polygon(geom['coordinates'], epsilon)
    elif geom['type'] == 'MultiPolygon':
        geom['coordinates'] = [simplify_polygon(poly, epsilon) for poly in geom['coordinates']]
    def round_coords(coords):
        if isinstance(coords[0], list):
            return [round_coords(c) for c in coords]
        return [round(coords[0], 5), round(coords[1], 5)] # 5 decimals is ~1 meter accuracy
    geom['coordinates'] = round_coords(geom['coordinates'])
    return geom

# URL is raw github content for datta07's Sub-district mapping of Haryana
GEOJSON_URL = "https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/refs/heads/master/INDIA/SUB%20DISTRICTS/HARYANA.geojson"

print("Downloading Haryana sub-district geometry...")
req = urllib.request.Request(GEOJSON_URL, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

print("Parsing boundaries and extracting Gurugram tehsils...")
# The shapefile calls it Gurgaon, we map it back to Gurugram tehsils
# MOCK_REGIONS IDs: gurugram-sadar, badshahpur, pataudi, manesar, farrukhnagar, sohna

gurugram_features = []

# Normalization map for sub-district names found in this specific repo to our accepted IDs
NAME_MAP = {
    "gurgaon": "gurugram-sadar",
    "badshahpur": "badshahpur",
    "pataudi": "pataudi",
    "manesar": "manesar",
    "farrukhnagar": "farrukhnagar",
    "sohna": "sohna"
}

for feat in data['features']:
    props = feat['properties']
    dist_name = props.get('dtname', '').lower()
    sub_dist_name = props.get('sdtname', '').lower()
    
    if dist_name == 'gurgaon':
        our_id = NAME_MAP.get(sub_dist_name)
        if our_id:
            print(f"    Found matches for {sub_dist_name} -> {our_id}")
            # Rebuild feature matching our exact expected spec
            new_feat = {
                "type": "Feature",
                "properties": {
                    "id": our_id,
                    "name": sub_dist_name.title(),
                    "districtId": "gurugram"
                },
                "geometry": simplify_geometry(feat['geometry'], 0.002) # gentle simplification
            }
            gurugram_features.append(new_feat)

out_data = {
    "type": "FeatureCollection",
    "features": gurugram_features
}

out_path = "data/geo/HR/gurugram.geojson"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out_data, f, separators=(',', ':'))

print(f"Successfully generated authentic bounding data for {len(gurugram_features)} tehsils and saved to {out_path}.")
