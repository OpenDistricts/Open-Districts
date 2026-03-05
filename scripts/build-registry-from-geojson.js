#!/usr/bin/env node

/**
 * OpenDistricts: Auto-Generate District Registry from GeoJSON Files
 * 
 * Scans /data/geo/{STATE}/{district}.geojson files and generates a complete
 * districts.json registry. This is the source-of-truth generator for the district
 * metadata that was previously manually maintained.
 * 
 * Usage:
 *   node build-registry-from-geojson.js [--output-file path/to/output.json]
 * 
 * Result:
 *   - Discovers all district geojson files
 *   - Extracts metadata from geojson feature properties
 *   - Generates standardized district entries
 *   - Writes to data/live/districts.json (or custom path)
 */

const fs = require('fs');
const path = require('path');

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "..", "data");
const GEO_DIR = path.join(DATA_DIR, "geo");

// ── HELPERS ────────────────────────────────────────────────────────────────

function slugify(str) {
    return (str || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

function bboxFromPolygon(polygon) {
    if (!polygon || !polygon[0]) return null;
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    polygon.forEach(coord => {
        if (Array.isArray(coord) && coord.length === 2) {
            const [lng, lat] = coord;
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
        }
    });
    
    return {
        north: maxLat,
        south: minLat,
        east: maxLng,
        west: minLng
    };
}

function extractBoundingBox(geometry) {
    if (!geometry) return null;
    
    let polygons = [];
    
    if (geometry.type === "Polygon" && geometry.coordinates.length > 0) {
        polygons.push(geometry.coordinates[0]);
    } else if (geometry.type === "MultiPolygon" && geometry.coordinates.length > 0) {
        polygons = geometry.coordinates.map(poly => poly[0]);
    }
    
    if (polygons.length === 0) return null;
    
    // Merge all polygon bounding boxes
    let merged = null;
    polygons.forEach(poly => {
        const bbox = bboxFromPolygon(poly);
        if (bbox) {
            if (!merged) {
                merged = bbox;
            } else {
                merged.north = Math.max(merged.north, bbox.north);
                merged.south = Math.min(merged.south, bbox.south);
                merged.east = Math.max(merged.east, bbox.east);
                merged.west = Math.min(merged.west, bbox.west);
            }
        }
    });
    
    return merged;
}

// ── MAIN ───────────────────────────────────────────────────────────────────

function main() {
    console.log("🔍 Scanning geojson files...\n");
    
    const districts = [];
    const stateFiles = new Set();
    const errors = [];
    
    // List all state directories
    const stateDirs = fs.readdirSync(GEO_DIR).filter(f => {
        const stat = fs.statSync(path.join(GEO_DIR, f));
        return stat.isDirectory() && f.length === 2; // State code is 2 chars
    });
    
    console.log(`Found ${stateDirs.length} state directories\n`);
    
    stateDirs.forEach(stateCode => {
        const stateDir = path.join(GEO_DIR, stateCode);
        const files = fs.readdirSync(stateDir).filter(f => f.endsWith('.geojson'));
        
        console.log(`📍 State ${stateCode} (${files.length} districts):`);
        
        files.forEach(file => {
            const districtId = file.replace('.geojson', '');
            const filePath = path.join(stateDir, file);
            
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const geojson = JSON.parse(content);
                
                if (!geojson.features || geojson.features.length === 0) {
                    console.log(`   ⚠️  ${districtId}: No features found (empty geojson)`);
                    return;
                }
                
                // District name from filename (not first feature)
                // Convert districtId (e.g. "pune") to proper name (e.g. "Pune")
                const districtName = districtId
                    .split('-')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
                
                // Compute bounding box from ALL features (not just first)
                let bbox = null;
                const geomBoxes = geojson.features
                    .map(f => extractBoundingBox(f.geometry))
                    .filter(b => b !== null);
                
                if (geomBoxes.length > 0) {
                    // Merge all feature bboxes to get district envelope
                    bbox = geomBoxes.reduce((merged, current) => {
                        return {
                            north: Math.max(merged.north, current.north),
                            south: Math.min(merged.south, current.south),
                            east: Math.max(merged.east, current.east),
                            west: Math.min(merged.west, current.west)
                        };
                    });
                }
                
                if (!bbox) {
                    console.log(`   ⚠️  ${districtId}: Could not extract bounding box`);
                    return;
                }
                
                const district = {
                    id: districtId,
                    stateId: stateCode,
                    name: districtName,
                    nameLocal: null,
                    geoJsonUrl: `./data/geo/${stateCode}/${districtId}.geojson`,
                    boundingBox: bbox,
                    population: 0,
                    aliases: []
                };
                
                districts.push(district);
                console.log(`   ✅ ${districtId}: "${districtName}" [${bbox.north.toFixed(2)}N, ${bbox.south.toFixed(2)}S]`);
                
            } catch (e) {
                const msg = `Failed to parse ${file}: ${e.message}`;
                errors.push(msg);
                console.log(`   ❌ ${districtId}: ${e.message}`);
            }
        });
        console.log("");
    });
    
    // Sort by state then district id
    districts.sort((a, b) => {
        if (a.stateId !== b.stateId) return a.stateId.localeCompare(b.stateId);
        return a.id.localeCompare(b.id);
    });
    
    console.log(`📊 Summary:`);
    console.log(`   ✅ Districts discovered: ${districts.length}`);
    console.log(`   ⚠️  Errors: ${errors.length}`);
    
    if (errors.length > 0) {
        console.log(`\n⚠️  Error details:`);
        errors.forEach(e => console.log(`   ${e}`));
    }
    
    // Write output
    const outputPath = path.join(DATA_DIR, "live", "districts.json");
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(districts, null, 2));
    console.log(`\n✨ Registry generated: ${outputPath}`);
    console.log(`   Total districts: ${districts.length}`);
    
    return districts;
}

if (require.main === module) {
    main();
}

module.exports = { main };
