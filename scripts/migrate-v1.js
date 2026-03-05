#!/usr/bin/env node

/**
 * Phase 1 Migration: Convert mock-events.js + mock-districts.js → /data/versions/v1/
 * 
 * This script:
 * 1. Dynamically imports the existing MOCK_EVENTS and MOCK_DISTRICTS
 * 2. Normalizes them to V4.1 schema
 * 3. Computes manifest hash
 * 4. Writes to /data/versions/v1/
 * 
 * Usage:
 *   node scripts/migrate-v1.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── PATHS ──────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "..", "data");
const V1_DIR = path.join(DATA_DIR, "versions", "v1");

// ── DYNAMIC IMPORT (read and eval JS) ──────────────────────────────────────

async function loadMockData() {
    console.log("📖 Reading existing mock data files...");
    
    // Read mock-events.js
    const eventsFile = path.join(DATA_DIR, "mock-events.js");
    const eventsContent = fs.readFileSync(eventsFile, "utf-8");
    
    // Extract MOCK_EVENTS array using regex
    const eventsMatch = eventsContent.match(/export const MOCK_EVENTS = \[([\s\S]*?)\];/);
    if (!eventsMatch) {
        console.error("Could not find MOCK_EVENTS export in mock-events.js");
        process.exit(1);
    }
    
    // Convert JS object syntax to JSON by wrapping in array and eval
    const eventsArrayStr = `[${eventsMatch[1]}]`;
    let events = [];
    try {
        // Replace unquoted keys and trailing commas to make valid JSON
        const jsonSafe = eventsArrayStr
            .replace(/'/g, '"')  // single quotes to double
            .replace(/,(\s*[}\]])/g, '$1')  // remove trailing commas
            .replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":');  // quote keys
        
        events = JSON.parse(jsonSafe);
    } catch (e) {
        console.error("Failed to parse MOCK_EVENTS:", e.message);
        // Fallback: try to use Node's native module loading
        try {
            const mod = require(eventsFile.replace(/\.js$/, ''));
            events = mod.MOCK_EVENTS || [];
        } catch (e2) {
            console.error("Fallback import also failed. Ensure mock-events.js is valid ES6.");
            process.exit(1);
        }
    }
    
    console.log(`   ✓ Found ${events.length} events`);
    
    // Read mock-districts.js
    const districtsFile = path.join(DATA_DIR, "mock-districts.js");
    const districtsContent = fs.readFileSync(districtsFile, "utf-8");
    
    // Extract both MOCK_STATES and MOCK_DISTRICTS
    const statesMatch = districtsContent.match(/export const MOCK_STATES = ([\s\S]*?);[\n\r]/);
    const districtsMatch = districtsContent.match(/export const MOCK_DISTRICTS = ([\s\S]*?);[\n\r]/);
    const regionsMatch = districtsContent.match(/export const MOCK_REGIONS = ([\s\S]*?);[\n\r]/);
    
    let states = [];
    let districts = [];
    let regions = {};
    
    if (statesMatch) {
        try {
            // Parse the computed states (they call MOCK_EVENTS.filter, so we need a different approach)
            // For now, extract from the array literal portions
            const statesArrayMatch = districtsContent.match(/(const _rawStates = \[([\s\S]*?)\];)/);
            if (statesArrayMatch) {
                const rawStatesStr = statesArrayMatch[1].replace(/const _rawStates = /, '');
                const jsonSafeStates = rawStatesStr
                    .replace(/'/g, '"')
                    .replace(/,(\s*[}\]])/g, '$1')
                    .replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":');
                states = JSON.parse(jsonSafeStates);
                console.log(`   ✓ Found ${states.length} states`);
            }
        } catch (e) {
            console.warn("   ⚠ Could not parse states, will extract from districts");
        }
    }
    
    if (districtsMatch) {
        try {
            const rawDistrictsMatch = districtsContent.match(/(const _rawDistricts = \[([\s\S]*?)\];[\n\r]*export const MOCK_DISTRICTS)/);
            if (rawDistrictsMatch) {
                const rawDistrictsStr = rawDistrictsMatch[1].replace(/const _rawDistricts = /, '');
                const jsonSafeDistricts = rawDistrictsStr
                    .replace(/'/g, '"')
                    .replace(/,(\s*[}\]])/g, '$1')
                    .replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":');
                districts = JSON.parse(jsonSafeDistricts);
                console.log(`   ✓ Found ${districts.length} districts`);
            }
        } catch (e) {
            console.error("Failed to parse districts:", e.message);
        }
    }
    
    if (regionsMatch) {
        try {
            const regionsStr = regionsMatch[1];
            const jsonSafeRegions = regionsStr
                .replace(/'/g, '"')
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":');
            regions = JSON.parse(jsonSafeRegions);
            console.log(`   ✓ Found regions for ${Object.keys(regions).length} districts`);
        } catch (e) {
            console.warn("   ⚠ Could not parse regions:", e.message);
        }
    }
    
    return { events, districts, states, regions };
}

// ── NORMALIZATION ──────────────────────────────────────────────────────────

function normalizeEvents(events) {
    return events.map(e => {
        const normalized = {
            id: e.id || "",
            stateId: e.stateId || "",
            districtId: e.districtId || "",
            regionId: e.regionId || null,
            category: e.category || "health",
            impactScale: e.impactScale || "POINT",
            title: e.title || "",
            summary: e.summary || "",
            timestamp: e.timestamp || new Date().toISOString(),
            expiresAt: e.expiresAt || null,
            source: e.source || "Manual Entry",
            verified: e.verified !== undefined ? e.verified : true,
        };
        
        // Canonical geoPoint
        if (e.geoPoint && typeof e.geoPoint.lat === 'number' && typeof e.geoPoint.lng === 'number') {
            normalized.geoPoint = e.geoPoint;
        }
        
        // Optional fields
        if (e.verifiedAt) normalized.verifiedAt = e.verifiedAt;
        if (e.meta) normalized.meta = e.meta;
        if (e.location) normalized.location = e.location;
        
        return normalized;
    });
}

function normalizeDistricts(districts, stateId) {
    return districts.map(d => ({
        id: d.id || "",
        stateId: d.stateId || stateId,
        name: d.name || "",
        nameLocal: d.nameLocal || null,
        geoJsonUrl: d.geoJsonUrl || `./data/geo/${d.stateId}/${d.id}.geojson`,
        boundingBox: d.boundingBox || null,
        population: d.population || 0,
        aliases: d.aliases || null
    }));
}

function normalizeStates(events, districts, states) {
    // Extract unique states from events and districts
    const stateSet = new Map();
    
    if (states && states.length > 0) {
        states.forEach(s => {
            stateSet.set(s.id, {
                id: s.id,
                name: s.name || "",
                nameLocal: s.nameLocal || null,
                geoJsonUrl: s.geoJsonUrl || `./data/geo/${s.id}/state-outline.geojson`
            });
        });
    }
    
    // Add from districts
    districts.forEach(d => {
        if (!stateSet.has(d.stateId)) {
            stateSet.set(d.stateId, {
                id: d.stateId,
                name: d.stateId,
                nameLocal: null,
                geoJsonUrl: `./data/geo/${d.stateId}/state-outline.geojson`
            });
        }
    });
    
    // Add from events
    events.forEach(e => {
        if (!stateSet.has(e.stateId)) {
            stateSet.set(e.stateId, {
                id: e.stateId,
                name: e.stateId,
                nameLocal: null,
                geoJsonUrl: `./data/geo/${e.stateId}/state-outline.geojson`
            });
        }
    });
    
    return Array.from(stateSet.values()).sort((a, b) => a.id.localeCompare(b.id));
}

// ── MANIFEST ───────────────────────────────────────────────────────────────

function computeManifest(events, districts, states, regions) {
    const payload = JSON.stringify({
        events: events.sort((a, b) => a.id.localeCompare(b.id)),
        districts: districts.sort((a, b) => a.id.localeCompare(b.id)),
        states: states.sort((a, b) => a.id.localeCompare(b.id)),
        regions: regions
    });

    const hash = crypto.createHash("sha256").update(payload).digest("hex");

    return {
        datasetVersion: "v1",
        schemaVersion: "4.1.0",
        generatedAt: new Date().toISOString(),
        sourceRevision: "phase1-migration",
        description: "Converted from mock-events.js and mock-districts.js",
        counts: {
            events: events.length,
            districts: districts.length,
            states: states.length
        },
        hash: hash
    };
}

// ── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
    console.log("🚀 Phase 1: Migrate mock data → /data/versions/v1/\n");
    
    // Load existing data
    const { events: rawEvents, districts: rawDistricts, states: rawStates, regions: rawRegions } = await loadMockData();
    
    if (rawEvents.length === 0) {
        console.error("No events loaded. Aborting.");
        process.exit(1);
    }
    
    // Normalize
    console.log("\n📝 Normalizing to V4.1 schema...");
    const events = normalizeEvents(rawEvents);
    const districts = normalizeDistricts(rawDistricts, null);
    const states = normalizeStates(events, districts, rawStates);
    
    console.log(`   ✓ Events: ${events.length}`);
    console.log(`   ✓ Districts: ${districts.length}`);
    console.log(`   ✓ States: ${states.length}`);
    
    // Compute manifest
    const manifest = computeManifest(events, districts, states, rawRegions);
    
    // Create v1 directory
    console.log("\n💾 Writing to /data/versions/v1/...");
    if (!fs.existsSync(V1_DIR)) {
        fs.mkdirSync(V1_DIR, { recursive: true });
    }
    
    // Write files
    fs.writeFileSync(path.join(V1_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(V1_DIR, "events.json"), JSON.stringify(events, null, 2));
    fs.writeFileSync(path.join(V1_DIR, "districts.json"), JSON.stringify(districts, null, 2));
    fs.writeFileSync(path.join(V1_DIR, "states.json"), JSON.stringify(states, null, 2));
    fs.writeFileSync(path.join(V1_DIR, "regions.json"), JSON.stringify(rawRegions, null, 2));
    
    console.log("   ✓ manifest.json");
    console.log("   ✓ events.json");
    console.log("   ✓ districts.json");
    console.log("   ✓ states.json");
    console.log("   ✓ regions.json");
    
    console.log(`\n✨ Migration complete!`);
    console.log(`\n📊 Summary:`);
    console.log(`   Events: ${events.length}`);
    console.log(`   Districts: ${districts.length}`);
    console.log(`   States: ${states.length}`);
    console.log(`   Manifest hash: ${manifest.hash.substring(0, 12)}...`);
    
    console.log(`\n📂 Location: ${V1_DIR}`);
    console.log(`\n🚀 Next: Run 'node promote-dataset.js --version v1 --strategy update' to make v1 live.`);
}

main().catch(err => {
    console.error("Fatal error:", err.message);
    process.exit(1);
});
