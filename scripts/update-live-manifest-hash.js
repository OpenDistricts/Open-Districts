#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const liveDir = path.join(__dirname, '../data/live');
const files = ['events.json', 'districts.json', 'states.json', 'regions.json'];

let combinedHash = '';

for (const file of files) {
  const filePath = path.join(liveDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${file} not found`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  combinedHash += hash;
  console.log(`${file}: ${hash.substring(0, 16)}...`);
}

const manifestHash = crypto.createHash('sha256').update(combinedHash).digest('hex');
console.log(`\n📦 Combined manifest hash: ${manifestHash}`);

const manifestPath = path.join(liveDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
manifest.hash = manifestHash;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✅ Live manifest hash updated');
