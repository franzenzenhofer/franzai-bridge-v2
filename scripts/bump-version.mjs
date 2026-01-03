#!/usr/bin/env node
/**
 * Auto-increment version on each build
 * Increments patch version (e.g., 2.0.0 -> 2.0.1)
 * SINGLE SOURCE OF TRUTH: Updates ALL version files at once
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const manifestPath = path.join(rootDir, "src/manifest.json");
const packagePath = path.join(rootDir, "package.json");
const versionJsonPath = path.join(rootDir, "public/downloads/version.json");

function bumpVersion(version) {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1; // Increment patch
  return parts.join(".");
}

function updateJsonFile(filePath, newVersion) {
  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const oldVersion = content.version;
  content.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n");
  return oldVersion;
}

function updateVersionJson(newVersion) {
  const zipName = `franzai-bridge-v${newVersion}.zip`;
  const versionInfo = {
    version: newVersion,
    filename: zipName,
    downloadUrl: `/downloads/${zipName}`,
    latestUrl: "/downloads/franzai-bridge-latest.zip",
    buildDate: new Date().toISOString(),
    size: 0
  };
  // Preserve size if file exists and we're not rebuilding
  if (fs.existsSync(versionJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
      if (existing.size) versionInfo.size = existing.size;
    } catch {}
  }
  fs.mkdirSync(path.dirname(versionJsonPath), { recursive: true });
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2) + "\n");
}

// Read current version from manifest
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const currentVersion = manifest.version;
const newVersion = bumpVersion(currentVersion);

// Update ALL version files - SINGLE SOURCE OF TRUTH
updateJsonFile(manifestPath, newVersion);
updateJsonFile(packagePath, newVersion);
updateVersionJson(newVersion);

console.log(`\x1b[32m✓ Version bumped: ${currentVersion} → ${newVersion}\x1b[0m`);
console.log(`  → package.json, manifest.json, version.json all synced`);
