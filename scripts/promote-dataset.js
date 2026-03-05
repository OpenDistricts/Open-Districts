#!/usr/bin/env node

/**
 * OpenDistricts V4.1 — Dataset Promotion & Versioning Script
 * 
 * Manages dataset lifecycle:
 *   - Promote a version to /data/live/ (becomes active)
 *   - Demote old live to history
 *   - Two strategies: immutable (new version) or in-place update (with backup)
 * 
 * Usage:
 *   node promote-dataset.js --version v2 --strategy immutable
 *   node promote-dataset.js --version v2 --strategy update
 *   node promote-dataset.js --list
 * 
 * Strategy Recommendation:
 *   - immutable: new Agent data → create v3, demote v2 to history, promote v3 to live (safe, auditable)
 *   - update: small patch → keep v2, backup old to history-v2-TIMESTAMP, update live, update v2 (fast)
 */

const fs = require('fs');
const path = require('path');

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "..", "data");
const VERSIONS_DIR = path.join(DATA_DIR, "versions");
const LIVE_DIR = path.join(DATA_DIR, "live");
const HISTORY_DIR = path.join(DATA_DIR, "history");

// ── CLI PARSING ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};

const action = args[0];
const version = getFlag("--version");
const strategy = getFlag("--strategy") || "immutable";

// ── HELPERS ────────────────────────────────────────────────────────────────

function copyDir(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }
    fs.readdirSync(source).forEach(file => {
        const sourceFile = path.join(source, file);
        const destFile = path.join(destination, file);
        if (fs.statSync(sourceFile).isDirectory()) {
            copyDir(sourceFile, destFile);
        } else {
            fs.copyFileSync(sourceFile, destFile);
        }
    });
}

function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
            const full = path.join(dir, file);
            if (fs.statSync(full).isDirectory()) {
                removeDir(full);
            } else {
                fs.unlinkSync(full);
            }
        });
        fs.rmdirSync(dir);
    }
}

function listVersions() {
    if (!fs.existsSync(VERSIONS_DIR)) {
        console.log("No versions directory found.");
        return;
    }
    const versions = fs.readdirSync(VERSIONS_DIR).filter(f => /^v\d+$/.test(f)).sort();
    console.log("Available versions:");
    versions.forEach(v => {
        const manifestPath = path.join(VERSIONS_DIR, v, "manifest.json");
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
            console.log(`  ${v}: ${manifest.counts.events} events, generated ${manifest.generatedAt}`);
        } else {
            console.log(`  ${v}: (no manifest)`);
        }
    });

    if (fs.existsSync(LIVE_DIR)) {
        const liveManifest = path.join(LIVE_DIR, "manifest.json");
        if (fs.existsSync(liveManifest)) {
            const manifest = JSON.parse(fs.readFileSync(liveManifest, "utf-8"));
            console.log(`\n🟢 LIVE: ${manifest.datasetVersion} (${manifest.counts.events} events)`);
        }
    }

    if (fs.existsSync(HISTORY_DIR)) {
        const history = fs.readdirSync(HISTORY_DIR).filter(f => f.startsWith("history-")).sort().reverse();
        if (history.length > 0) {
            console.log("\nHistory backups:");
            history.slice(0, 5).forEach(h => console.log(`  ${h}`));
            if (history.length > 5) console.log(`  ... and ${history.length - 5} more`);
        }
    }
}

// ── PRE-FLIGHT VALIDATION ──────────────────────────────────────────────────

/**
 * Cross-check every event.districtId against the district registry in the
 * same version folder. Blocks promotion if any districtId is unregistered.
 * This is the final safety gate before a dataset goes live.
 *
 * @param {string} versionPath  Absolute path to the version folder
 * @returns {{ valid: boolean, orphans: Array<{eventId, districtId, stateId}> }}
 */
function validateDatasetConsistency(versionPath) {
    const eventsPath = path.join(versionPath, "events.json");
    const districtsPath = path.join(versionPath, "districts.json");

    if (!fs.existsSync(eventsPath) || !fs.existsSync(districtsPath)) {
        console.warn("   Warning: events.json or districts.json missing — skipping referential integrity check.");
        return { valid: true, orphans: [] };
    }

    const events = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
    const districts = JSON.parse(fs.readFileSync(districtsPath, "utf-8"));
    const knownDistrictIds = new Set(districts.map(d => d.id));

    const orphans = [];
    events.forEach(evt => {
        if (!knownDistrictIds.has(evt.districtId)) {
            orphans.push({ eventId: evt.id, districtId: evt.districtId, stateId: evt.stateId });
        }
    });

    return { valid: orphans.length === 0, orphans };
}

// ── STRATEGIES ─────────────────────────────────────────────────────────────

function promoteImmutable(versionName) {
    const versionPath = path.join(VERSIONS_DIR, versionName);

    if (!fs.existsSync(versionPath)) {
        console.error(`Version ${versionName} does not exist in ${VERSIONS_DIR}`);
        process.exit(1);
    }

    // ── PRE-FLIGHT: referential integrity ──────────────────────────────────
    console.log(`\n🔗 Pre-flight: checking referential integrity in ${versionName}...`);
    const integrity = validateDatasetConsistency(versionPath);
    if (!integrity.valid) {
        console.error(`\n❌ Promotion BLOCKED — ${integrity.orphans.length} event(s) reference unregistered districtId(s):`);
        const byDistrict = {};
        integrity.orphans.forEach(o => {
            byDistrict[o.districtId] = byDistrict[o.districtId] || { stateId: o.stateId, count: 0 };
            byDistrict[o.districtId].count++;
        });
        Object.entries(byDistrict).forEach(([dId, { stateId, count }]) => {
            console.error(`   districtId '${dId}' (stateId: ${stateId}) — ${count} event(s) orphaned`);
        });
        console.error("\n   Fix: add the missing district(s) to districts.json and re-run.");
        process.exit(1);
    }
    console.log(`   ✅ All event districtIds are registered (${integrity.orphans.length} orphans found: none).`);
    console.log(`   Promoting ${versionName} to /data/live/...`);

    // Backup current live to history
    if (fs.existsSync(LIVE_DIR)) {
        const liveManifest = path.join(LIVE_DIR, "manifest.json");
        let currentVersion = "unknown";
        if (fs.existsSync(liveManifest)) {
            try {
                const manifest = JSON.parse(fs.readFileSync(liveManifest, "utf-8"));
                currentVersion = manifest.datasetVersion;
            } catch (e) {}
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        const historyName = `history-${currentVersion}-${timestamp}`;
        const historyPath = path.join(HISTORY_DIR, historyName);

        console.log(`   Backing up old live (${currentVersion}) → ${historyName}...`);
        copyDir(LIVE_DIR, historyPath);
    }

    // Clear live
    if (fs.existsSync(LIVE_DIR)) {
        removeDir(LIVE_DIR);
    }

    // Copy version to live
    console.log(`   Copying ${versionName} → /data/live/...`);
    fs.mkdirSync(LIVE_DIR, { recursive: true });
    copyDir(versionPath, LIVE_DIR);

    console.log(`✅ Success! ${versionName} is now LIVE.`);
    console.log(`   Old live backed up to history/`);
}

function promoteUpdate(versionName) {
    const versionPath = path.join(VERSIONS_DIR, versionName);

    if (!fs.existsSync(versionPath)) {
        console.error(`Version ${versionName} does not exist in ${VERSIONS_DIR}`);
        process.exit(1);
    }

    // ── PRE-FLIGHT: referential integrity ──────────────────────────────────
    console.log(`\n🔗 Pre-flight: checking referential integrity in ${versionName}...`);
    const integrity = validateDatasetConsistency(versionPath);
    if (!integrity.valid) {
        console.error(`\n❌ Promotion BLOCKED — ${integrity.orphans.length} event(s) reference unregistered districtId(s):`);
        const byDistrict = {};
        integrity.orphans.forEach(o => {
            byDistrict[o.districtId] = byDistrict[o.districtId] || { stateId: o.stateId, count: 0 };
            byDistrict[o.districtId].count++;
        });
        Object.entries(byDistrict).forEach(([dId, { stateId, count }]) => {
            console.error(`   districtId '${dId}' (stateId: ${stateId}) — ${count} event(s) orphaned`);
        });
        console.error("\n   Fix: add the missing district(s) to districts.json and re-run.");
        process.exit(1);
    }
    console.log(`   ✅ All event districtIds are registered.`);

    console.log(`\n🔄 Strategy: UPDATE (in-place with backup)`);
    console.log(`   Backing up current live...`);

    // Backup current live
    if (fs.existsSync(LIVE_DIR)) {
        const liveManifest = path.join(LIVE_DIR, "manifest.json");
        let currentVersion = "unknown";
        if (fs.existsSync(liveManifest)) {
            try {
                const manifest = JSON.parse(fs.readFileSync(liveManifest, "utf-8"));
                currentVersion = manifest.datasetVersion;
            } catch (e) {}
        }

        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const historyName = `history-${currentVersion}-${timestamp}`;
        const historyPath = path.join(HISTORY_DIR, historyName);

        console.log(`   Storing previous live as ${historyName}...`);
        copyDir(LIVE_DIR, historyPath);
    }

    // Overwrite live with new version
    console.log(`   Updating /data/live/ from ${versionName}...`);
    if (!fs.existsSync(LIVE_DIR)) {
        fs.mkdirSync(LIVE_DIR, { recursive: true });
    }
    fs.readdirSync(versionPath).forEach(file => {
        const src = path.join(versionPath, file);
        const dst = path.join(LIVE_DIR, file);
        if (fs.statSync(src).isDirectory()) {
            removeDir(dst);
            copyDir(src, dst);
        } else {
            fs.copyFileSync(src, dst);
        }
    });

    console.log(`✅ Success! /data/live/ updated from ${versionName}.`);
    console.log(`   Previous state backed up to history/`);
}

// ── MAIN ───────────────────────────────────────────────────────────────────

function main() {
    if (!action || action === "--help" || action === "-h") {
        console.log(`
OpenDistricts V4.1 — Dataset Promotion & Versioning

Usage:
  node promote-dataset.js --list                          List all versions and current live
  node promote-dataset.js --version v2 --strategy immutable   Promote v2 (new version, backup old)
  node promote-dataset.js --version v2 --strategy update      Update live from v2 (fast patch)

Strategies:
  immutable   Create new version folder, demote current live to history (safe, auditable)
  update      Update /data/live/ in place with backup to history (fast for patches)
        `);
        return;
    }

    if (action === "--list") {
        listVersions();
        return;
    }

    if (action === "--version") {
        if (!version) {
            console.error("--version requires an argument");
            process.exit(1);
        }

        if (strategy === "immutable") {
            promoteImmutable(version);
        } else if (strategy === "update") {
            promoteUpdate(version);
        } else {
            console.error(`Unknown strategy: ${strategy}. Use 'immutable' or 'update'.`);
            process.exit(1);
        }
        return;
    }

    console.error(`Unknown action: ${action}`);
    process.exit(1);
}

main();
