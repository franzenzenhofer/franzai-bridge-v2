#!/usr/bin/env node
/**
 * Generate extension icons using Google Gemini Imagen API
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, "../src/icons");

// Gemini API key - set via GOOGLE_API_KEY env var
const API_KEY = process.env.GOOGLE_API_KEY ?? "";

const ICON_SIZES = [16, 32, 48, 128];

const PROMPT = `Create a modern, minimalist app icon for "FranzAI Bridge" - a developer tool Chrome extension.
The icon should feature:
- A stylized bridge symbol combined with AI/neural network elements
- Primary colors: blue (#1a73e8) and white
- Clean, flat design suitable for small sizes
- Professional tech aesthetic
- No text, just the symbol
- Square format with rounded corners
- Simple enough to be recognizable at 16x16 pixels`;

async function generateIcon() {
  console.log("Generating icon with Gemini Imagen API...");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt: PROMPT }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        safetyFilterLevel: "block_few",
        personGeneration: "dont_allow"
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("API Error:", response.status, error);

    // Try alternative endpoint
    console.log("\nTrying alternative Gemini endpoint...");
    return await generateWithGeminiFlash();
  }

  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2).slice(0, 500));

  if (data.predictions && data.predictions[0]?.bytesBase64Encoded) {
    const base64 = data.predictions[0].bytesBase64Encoded;
    const buffer = Buffer.from(base64, "base64");

    // Save the main icon
    const iconPath = path.join(ICONS_DIR, "icon-128.png");
    fs.writeFileSync(iconPath, buffer);
    console.log(`Saved: ${iconPath}`);

    return buffer;
  }

  throw new Error("No image in response");
}

async function generateWithGeminiFlash() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Generate an image: ${PROMPT}`
        }]
      }],
      generationConfig: {
        responseModalities: ["image", "text"]
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini Flash API Error: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log("Gemini Flash Response received");

  // Look for image in response
  const candidates = data.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        const base64 = part.inlineData.data;
        const buffer = Buffer.from(base64, "base64");

        const iconPath = path.join(ICONS_DIR, "icon-128.png");
        fs.writeFileSync(iconPath, buffer);
        console.log(`Saved: ${iconPath}`);

        return buffer;
      }
    }
  }

  throw new Error("No image generated");
}

async function resizeIcon(inputBuffer, size) {
  // Use sharp if available, otherwise we'll need to install it
  try {
    const sharp = (await import("sharp")).default;
    const resized = await sharp(inputBuffer)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return resized;
  } catch (e) {
    console.log(`Note: sharp not available for resizing. Install with: npm install sharp`);
    return null;
  }
}

async function main() {
  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  try {
    const iconBuffer = await generateIcon();

    // Try to resize to all needed sizes
    for (const size of ICON_SIZES) {
      if (size === 128) continue; // Already saved

      const resized = await resizeIcon(iconBuffer, size);
      if (resized) {
        const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
        fs.writeFileSync(outPath, resized);
        console.log(`Saved: ${outPath}`);
      }
    }

    console.log("\nDone! Icons saved to src/icons/");
  } catch (error) {
    console.error("Failed to generate icons:", error.message);
    console.log("\nCreating fallback SVG icons...");
    await createFallbackIcons();
  }
}

async function createFallbackIcons() {
  // Create a simple SVG icon as fallback
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a73e8"/>
      <stop offset="100%" style="stop-color:#0d47a1"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#bg)"/>
  <!-- Bridge arch -->
  <path d="M20 85 Q64 35 108 85" stroke="white" stroke-width="8" fill="none" stroke-linecap="round"/>
  <!-- Bridge pillars -->
  <line x1="35" y1="85" x2="35" y2="100" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <line x1="64" y1="60" x2="64" y2="100" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <line x1="93" y1="85" x2="93" y2="100" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <!-- AI dots -->
  <circle cx="40" cy="45" r="5" fill="rgba(255,255,255,0.7)"/>
  <circle cx="64" cy="38" r="5" fill="rgba(255,255,255,0.7)"/>
  <circle cx="88" cy="45" r="5" fill="rgba(255,255,255,0.7)"/>
  <!-- Connection lines -->
  <line x1="40" y1="45" x2="64" y2="38" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
  <line x1="64" y1="38" x2="88" y2="45" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
</svg>`;

  // Save SVG
  fs.writeFileSync(path.join(ICONS_DIR, "icon.svg"), svgIcon);
  console.log("Saved: icon.svg");

  // Convert SVG to PNG using resvg-js if available
  try {
    const { Resvg } = await import("@resvg/resvg-js");

    for (const size of ICON_SIZES) {
      const resvg = new Resvg(svgIcon, {
        fitTo: { mode: "width", value: size }
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
      fs.writeFileSync(outPath, pngBuffer);
      console.log(`Saved: ${outPath}`);
    }

    console.log("\nDone! Icons saved to src/icons/");
  } catch (e) {
    console.log("\nresvg-js not installed. Run: npm install @resvg/resvg-js --save-dev");
    console.log("Then run this script again to generate PNG icons.");
    console.log("\nSVG icon saved - you can manually convert it to PNG.");
  }
}

main().catch(console.error);
