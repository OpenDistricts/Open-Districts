import json
import math

def point_line_distance(p, a, b):
    # p, a, b are [x, y]. Distance of point p to line segment ab
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

def simplify_polygon(polygon, epsilon=0.03):
    return [douglas_peucker(ring, epsilon) for ring in polygon]

def simplify_geometry(geom, epsilon=0.03):
    if geom['type'] == 'Polygon':
        geom['coordinates'] = simplify_polygon(geom['coordinates'], epsilon)
    elif geom['type'] == 'MultiPolygon':
        geom['coordinates'] = [simplify_polygon(poly, epsilon) for poly in geom['coordinates']]
    # Also round coordinates to 3 decimals to save space
    def round_coords(coords):
        if isinstance(coords[0], list):
            return [round_coords(c) for c in coords]
        return [round(coords[0], 3), round(coords[1], 3)]
    geom['coordinates'] = round_coords(geom['coordinates'])
    return geom

STATE_MAPPINGS = {
    "Orissa": {"code": "OD", "name": "Odisha"},
    "Odisha": {"code": "OD", "name": "Odisha"},
    "Maharashtra": {"code": "MH", "name": "Maharashtra"},
    "Tamil Nadu": {"code": "TN", "name": "Tamil Nadu"},
    "Karnataka": {"code": "KA", "name": "Karnataka"},
    "West Bengal": {"code": "WB", "name": "West Bengal"},
    "Gujarat": {"code": "GJ", "name": "Gujarat"},
    "Uttar Pradesh": {"code": "UP", "name": "Uttar Pradesh"},
    "Rajasthan": {"code": "RJ", "name": "Rajasthan"},
    "Madhya Pradesh": {"code": "MP", "name": "Madhya Pradesh"}
}

print("Loading geojson...")
with open("data/geo/india-states.geojson", "r", encoding="utf-8") as f:
    data = json.load(f)

print("Simplifying...")
simplified_features = []
for feat in data['features']:
    props = feat['properties']
    # Attempt to find the name. In Subhash repo, it's usually NAME_1
    name = props.get('NAME_1', '')
    
    mapping = STATE_MAPPINGS.get(name)
    code = mapping["code"] if mapping else name.upper().replace(" ", "_")[:4]
    display_name = mapping["name"] if mapping else name
    
    new_feat = {
        "type": "Feature",
        "properties": {
            "name": display_name,
            "id": code
        },
        "geometry": simplify_geometry(feat['geometry'], 0.05)
    }
    simplified_features.append(new_feat)

out_data = {
    "type": "FeatureCollection",
    "features": simplified_features
}

with open("data/geo/india-states-simplified.geojson", "w", encoding="utf-8") as f:
    json.dump(out_data, f, separators=(',', ':'))

print("Done!")
