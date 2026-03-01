import json
import re
import os
import sys

def update_events_file(events_file_path, new_events):
    with open(events_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the MOCK_EVENTS array
    pattern = r'(export const MOCK_EVENTS = \[)(.*?)(\];)'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        print(f"Error: Could not find MOCK_EVENTS array in {events_file_path}")
        return

    prefix = match.group(1)
    existing_events_str = match.group(2)
    suffix = match.group(3)

    # Simplified parsing: assume standard JSON-like objects
    # For a real implementation, we might want to use a JS parser, 
    # but for this mock setup, we can append new items.
    
    # Check for duplicates by id
    new_filtered = []
    for ne in new_events:
        if f'id: "{ne["id"]}"' not in existing_events_str and f"id: '{ne['id']}'" not in existing_events_str:
            new_filtered.append(ne)

    if not new_filtered:
        print("No new events to add.")
        return

    # Format new events as JS objects
    new_entries = []
    for e in new_filtered:
        # Use json.dumps but convert property keys to unquoted for style (optional)
        js_obj = json.dumps(e, indent=2)
        # Convert "key": to key:
        js_obj = re.sub(r'"(\w+)":', r'\1:', js_obj)
        new_entries.append(js_obj)

    new_content_block = existing_events_str.rstrip()
    if new_content_block and not new_content_block.endswith(','):
        new_content_block += ','
    
    new_content_block += "\n\n  " + ",\n  ".join(new_entries) + "\n"
    
    updated_content = content[:match.start()] + prefix + new_content_block + suffix + content[match.end():]
    
    with open(events_file_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    print(f"Added {len(new_filtered)} events to {events_file_path}")

def update_districts_file(districts_file_path, district_id, state_id, region_index):
    with open(districts_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update _rawDistricts
    if f'id: "{district_id}"' not in content:
        print(f"Adding new district metadata for {district_id}")
        dist_pattern = r'(const _rawDistricts = \[)(.*?)(\];)'
        match = re.search(dist_pattern, content, re.DOTALL)
        if match:
            # We'll just define a base object
            new_dist = {
                "id": district_id,
                "stateId": state_id,
                "name": district_id.capitalize(),
                "nameLocal": "",
                "geoJsonUrl": f"/data/geo/{state_id}/{district_id}.geojson",
                "boundingBox": { "north": 0, "south": 0, "east": 0, "west": 0 },
                "population": 0
            }
            js_dist = json.dumps(new_dist, indent=8)
            js_dist = re.sub(r'"(\w+)":', r'\1:', js_dist)
            
            existing = match.group(2).rstrip()
            if existing and not existing.endswith(','):
                existing += ','
            new_block = existing + "\n" + js_dist + "\n    "
            content = content[:match.start()] + match.group(1) + new_block + match.group(3) + content[match.end():]

    # 2. Update MOCK_REGIONS
    regions_pattern = r'(export const MOCK_REGIONS = \{)(.*?)(\};)'
    match = re.search(regions_pattern, content, re.DOTALL)
    if match:
        prefix = match.group(1)
        existing_regions = match.group(2)
        suffix = match.group(3)
        
        # Check if district already in regions
        if f'"{district_id}":' in existing_regions:
            # Replace existing block for this district
            pattern_inner = rf'"{district_id}":\s*\[.*?\]'
            new_regions_js = f'"{district_id}": ' + json.dumps([{"id": r["id"], "name": r["name"]} for r in region_index["regions"]], indent=8)
            new_regions_js = re.sub(r'"(\w+)":', r'\1:', new_regions_js)
            existing_regions = re.sub(pattern_inner, new_regions_js, existing_regions, flags=re.DOTALL)
        else:
            # Append to dictionary
            new_regions_js = f'    "{district_id}": ' + json.dumps([{"id": r["id"], "name": r["name"]} for r in region_index["regions"]], indent=8)
            new_regions_js = re.sub(r'"(\w+)":', r'\1:', new_regions_js)
            existing_regions = existing_regions.rstrip()
            if existing_regions and not existing_regions.endswith(','):
                existing_regions += ','
            existing_regions += "\n" + new_regions_js + "\n"
            
        content = content[:match.start()] + prefix + existing_regions + suffix + content[match.end():]

    with open(districts_file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated metadata for {district_id} in {districts_file_path}")

def save_region_index(output_path, region_index):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(region_index, f, indent=2)
    print(f"Saved region index to {output_path}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python ingest_data.py <input_json_file>")
        return

    input_file = sys.argv[1]
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    events = data.get("events", [])
    region_index = data.get("regionIndex", {})
    
    if not events or not region_index:
        print("Error: Input JSON must contain both 'events' and 'regionIndex' keys.")
        return

    district_id = region_index["districtId"]
    state_id = region_index["stateId"]
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 1. Update Events
    update_events_file(os.path.join(base_dir, "data", "mock-events.js"), events)
    
    # 2. Update Districts & Regions
    update_districts_file(os.path.join(base_dir, "data", "mock-districts.js"), district_id, state_id, region_index)
    
    # 3. Save Region Index file
    save_region_index(os.path.join(base_dir, "data", "region-index", f"{state_id}_{district_id}.json"), region_index)

if __name__ == "__main__":
    main()
