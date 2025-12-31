#!/usr/bin/env node
/**
 * Build and package extension as a versioned ZIP file
 * Creates: public/downloads/franzai-bridge-v{version}.zip
 */

import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, statSync, existsSync, copyFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DOWNLOADS = join(ROOT, 'public', 'downloads');

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const version = pkg.version;

console.log(`\n📦 Building FranzAI Bridge v${version}\n`);

// Step 1: Build the extension
console.log('1️⃣  Building extension...');
try {
  execFileSync('npm', ['run', 'build:nobump'], { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Step 2: Create downloads directory
console.log('\n2️⃣  Creating downloads directory...');
mkdirSync(DOWNLOADS, { recursive: true });

// Step 3: Create ZIP using native zip command
const zipName = `franzai-bridge-v${version}.zip`;
const zipPath = join(DOWNLOADS, zipName);
const latestZipPath = join(DOWNLOADS, 'franzai-bridge-latest.zip');

console.log(`\n3️⃣  Creating ${zipName}...`);

try {
  // Remove old zip if exists
  if (existsSync(zipPath)) {
    unlinkSync(zipPath);
  }

  // Create zip from dist directory using execFileSync with array args
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: DIST, stdio: 'pipe' });

  // Also create/update latest.zip
  copyFileSync(zipPath, latestZipPath);

  // Get file size
  const stats = statSync(zipPath);
  const sizeKB = (stats.size / 1024).toFixed(1);

  console.log(`✅ Created: ${zipPath}`);
  console.log(`   Size: ${sizeKB} KB`);
  console.log(`✅ Also copied to: ${latestZipPath}`);
} catch (e) {
  console.error('❌ Failed to create ZIP:', e.message);
  process.exit(1);
}

// Step 4: Create version manifest for the website
const versionInfo = {
  version,
  filename: zipName,
  downloadUrl: `/downloads/${zipName}`,
  latestUrl: '/downloads/franzai-bridge-latest.zip',
  buildDate: new Date().toISOString(),
  size: statSync(zipPath).size
};

const versionPath = join(DOWNLOADS, 'version.json');
writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
console.log(`\n4️⃣  Created version manifest: ${versionPath}`);

console.log(`
✨ Build complete!

📁 Files created:
   • ${zipPath}
   • ${latestZipPath}
   • ${versionPath}

🔗 Download URLs (after deploy):
   • https://bridge.franzai.com/downloads/${zipName}
   • https://bridge.franzai.com/downloads/franzai-bridge-latest.zip
`);
