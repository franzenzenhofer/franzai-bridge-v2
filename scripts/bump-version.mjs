#!/usr/bin/env node
/**
 * Auto-increment version on each build
 * Increments patch version (e.g., 2.0.0 -> 2.0.1)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const manifestPath = path.join(rootDir, "src/manifest.json");
const packagePath = path.join(rootDir, "package.json");

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

// Read current version from manifest
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const currentVersion = manifest.version;
const newVersion = bumpVersion(currentVersion);

// Update both files
updateJsonFile(manifestPath, newVersion);
updateJsonFile(packagePath, newVersion);

console.log(`\x1b[32m✓ Version bumped: ${currentVersion} → ${newVersion}\x1b[0m`);
