#!/usr/bin/env node
/**
 * Generate Chrome Web Store marketing assets
 * - Small promo tile: 440x280
 * - Large promo tile (marquee): 920x680
 * - Screenshots: 1280x800
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, "../marketing");

// Ensure marketing directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Common brand colors
const BRAND_BLUE = "#1a73e8";
const BRAND_DARK = "#0d47a1";

/**
 * Generate Small Promo Tile (440x280)
 */
function generateSmallPromo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${BRAND_BLUE}"/>
      <stop offset="100%" style="stop-color:${BRAND_DARK}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="440" height="280" fill="url(#bg)"/>

  <!-- Bridge Icon (centered, larger) -->
  <g transform="translate(170, 60)">
    <path d="M0 80 Q50 20 100 80" stroke="white" stroke-width="8" fill="none" stroke-linecap="round"/>
    <line x1="20" y1="80" x2="20" y2="100" stroke="white" stroke-width="6" stroke-linecap="round"/>
    <line x1="50" y1="50" x2="50" y2="100" stroke="white" stroke-width="6" stroke-linecap="round"/>
    <line x1="80" y1="80" x2="80" y2="100" stroke="white" stroke-width="6" stroke-linecap="round"/>
    <!-- AI dots -->
    <circle cx="25" cy="30" r="6" fill="rgba(255,255,255,0.8)"/>
    <circle cx="50" cy="20" r="6" fill="rgba(255,255,255,0.8)"/>
    <circle cx="75" cy="30" r="6" fill="rgba(255,255,255,0.8)"/>
    <line x1="25" y1="30" x2="50" y2="20" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    <line x1="50" y1="20" x2="75" y2="30" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
  </g>

  <!-- Title -->
  <text x="220" y="200" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="white">FranzAI Bridge</text>

  <!-- Subtitle -->
  <text x="220" y="235" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="rgba(255,255,255,0.9)">CORS Bypass &amp; API Key Injection</text>

  <!-- Version badge -->
  <rect x="185" y="250" width="70" height="20" rx="10" fill="rgba(255,255,255,0.2)"/>
  <text x="220" y="264" text-anchor="middle" font-family="monospace" font-size="11" fill="white">v2.0</text>
</svg>`;

  fs.writeFileSync(path.join(ASSETS_DIR, "promo-small-440x280.svg"), svg);
  console.log("Created: promo-small-440x280.svg");
}

/**
 * Generate Large Promo Tile / Marquee (920x680)
 */
function generateLargePromo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="680" viewBox="0 0 920 680">
  <defs>
    <linearGradient id="bgLarge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${BRAND_BLUE}"/>
      <stop offset="100%" style="stop-color:${BRAND_DARK}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="920" height="680" fill="url(#bgLarge)"/>

  <!-- Large Bridge Icon -->
  <g transform="translate(360, 120)">
    <path d="M0 120 Q100 30 200 120" stroke="white" stroke-width="12" fill="none" stroke-linecap="round"/>
    <line x1="40" y1="120" x2="40" y2="160" stroke="white" stroke-width="10" stroke-linecap="round"/>
    <line x1="100" y1="70" x2="100" y2="160" stroke="white" stroke-width="10" stroke-linecap="round"/>
    <line x1="160" y1="120" x2="160" y2="160" stroke="white" stroke-width="10" stroke-linecap="round"/>
    <!-- AI network dots -->
    <circle cx="50" cy="45" r="10" fill="rgba(255,255,255,0.8)"/>
    <circle cx="100" cy="30" r="10" fill="rgba(255,255,255,0.8)"/>
    <circle cx="150" cy="45" r="10" fill="rgba(255,255,255,0.8)"/>
    <line x1="50" y1="45" x2="100" y2="30" stroke="rgba(255,255,255,0.5)" stroke-width="3"/>
    <line x1="100" y1="30" x2="150" y2="45" stroke="rgba(255,255,255,0.5)" stroke-width="3"/>
  </g>

  <!-- Title -->
  <text x="460" y="370" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="700" fill="white">FranzAI Bridge</text>

  <!-- Tagline -->
  <text x="460" y="430" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="rgba(255,255,255,0.9)">Secure CORS Bypass &amp; API Key Injection</text>

  <!-- Features -->
  <g transform="translate(160, 480)" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="rgba(255,255,255,0.85)">
    <text x="0" y="0">&#x2713; Bypass CORS restrictions securely</text>
    <text x="0" y="40">&#x2713; Auto-inject API keys (OpenAI, Anthropic, Google, Mistral)</text>
    <text x="0" y="80">&#x2713; Real-time request inspector</text>
    <text x="0" y="120">&#x2713; DevTools-style network panel</text>
  </g>

  <!-- Version -->
  <rect x="410" y="630" width="100" height="30" rx="15" fill="rgba(255,255,255,0.2)"/>
  <text x="460" y="651" text-anchor="middle" font-family="monospace" font-size="14" fill="white">v2.0</text>
</svg>`;

  fs.writeFileSync(path.join(ASSETS_DIR, "promo-large-920x680.svg"), svg);
  console.log("Created: promo-large-920x680.svg");
}

/**
 * Generate Screenshot mockup (1280x800)
 */
function generateScreenshot() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <!-- Browser chrome background -->
  <rect width="1280" height="800" fill="#f5f5f5"/>

  <!-- Browser title bar -->
  <rect width="1280" height="40" fill="#e0e0e0"/>
  <circle cx="20" cy="20" r="6" fill="#ff5f56"/>
  <circle cx="40" cy="20" r="6" fill="#ffbd2e"/>
  <circle cx="60" cy="20" r="6" fill="#27c93f"/>
  <rect x="100" y="10" width="400" height="20" rx="4" fill="white"/>
  <text x="120" y="25" font-family="system-ui" font-size="12" fill="#666">localhost:3000</text>

  <!-- Main page area -->
  <rect x="0" y="40" width="900" height="760" fill="white"/>

  <!-- Side panel -->
  <rect x="900" y="40" width="380" height="760" fill="#f1f3f4"/>

  <!-- Side panel header -->
  <rect x="900" y="40" width="380" height="36" fill="#f1f3f4"/>
  <text x="920" y="64" font-family="system-ui" font-size="13" font-weight="600" fill="#202124">FranzAI Bridge</text>
  <text x="1020" y="64" font-family="monospace" font-size="10" fill="#5f6368">v2.0</text>

  <!-- Toolbar -->
  <rect x="900" y="76" width="380" height="32" fill="white"/>
  <text x="920" y="96" font-family="system-ui" font-size="12" font-weight="600" fill="#202124">Requests</text>
  <rect x="990" y="86" width="24" height="16" rx="8" fill="#1a73e8"/>
  <text x="1002" y="98" text-anchor="middle" font-family="system-ui" font-size="10" fill="white">5</text>

  <!-- Table header -->
  <rect x="900" y="108" width="380" height="24" fill="#f1f3f4"/>
  <text x="920" y="124" font-family="system-ui" font-size="10" fill="#5f6368" text-transform="uppercase">TIME</text>
  <text x="970" y="124" font-family="system-ui" font-size="10" fill="#5f6368">METHOD</text>
  <text x="1030" y="124" font-family="system-ui" font-size="10" fill="#5f6368">HOST</text>
  <text x="1140" y="124" font-family="system-ui" font-size="10" fill="#5f6368">STATUS</text>

  <!-- Request rows -->
  <g font-family="'Roboto Mono', monospace" font-size="11">
    <!-- Row 1 - selected -->
    <rect x="900" y="132" width="380" height="28" fill="#e8f0fe"/>
    <rect x="900" y="132" width="2" height="28" fill="#1a73e8"/>
    <text x="920" y="150" fill="#5f6368">14:32:01</text>
    <text x="970" y="150" fill="#1a73e8" font-weight="600">GET</text>
    <text x="1030" y="150" fill="#5f6368">api.openai.com</text>
    <text x="1140" y="150" fill="#188038">200</text>

    <!-- Row 2 -->
    <rect x="900" y="160" width="380" height="28" fill="white"/>
    <text x="920" y="178" fill="#5f6368">14:31:58</text>
    <text x="970" y="178" fill="#188038" font-weight="600">POST</text>
    <text x="1030" y="178" fill="#5f6368">api.anthropic.com</text>
    <text x="1140" y="178" fill="#188038">200</text>

    <!-- Row 3 -->
    <rect x="900" y="188" width="380" height="28" fill="white"/>
    <text x="920" y="206" fill="#5f6368">14:31:55</text>
    <text x="970" y="206" fill="#188038" font-weight="600">POST</text>
    <text x="1030" y="206" fill="#5f6368">generativelanguage...</text>
    <text x="1140" y="206" fill="#188038">200</text>

    <!-- Row 4 -->
    <rect x="900" y="216" width="380" height="28" fill="white"/>
    <text x="920" y="234" fill="#5f6368">14:31:50</text>
    <text x="970" y="234" fill="#1a73e8" font-weight="600">GET</text>
    <text x="1030" y="234" fill="#5f6368">api.mistral.ai</text>
    <text x="1140" y="234" fill="#d93025">401</text>

    <!-- Row 5 -->
    <rect x="900" y="244" width="380" height="28" fill="white"/>
    <text x="920" y="262" fill="#5f6368">14:31:45</text>
    <text x="970" y="262" fill="#e37400" font-weight="600">PUT</text>
    <text x="1030" y="262" fill="#5f6368">api.openai.com</text>
    <text x="1140" y="262" fill="#188038">200</text>
  </g>

  <!-- Details panel -->
  <rect x="900" y="280" width="380" height="520" fill="white"/>

  <!-- Detail header -->
  <rect x="900" y="280" width="380" height="32" fill="#f1f3f4"/>
  <text x="920" y="300" font-family="system-ui" font-size="11" fill="#202124">GET https://api.openai.com/v1/models</text>

  <!-- Request headers section -->
  <rect x="900" y="312" width="380" height="28" fill="#f1f3f4"/>
  <text x="920" y="330" font-family="system-ui" font-size="11" font-weight="600" fill="#202124">REQUEST HEADERS</text>

  <g font-family="'Roboto Mono', monospace" font-size="11" fill="#202124">
    <text x="920" y="360">Authorization: Bearer sk-***</text>
    <text x="920" y="380">Content-Type: application/json</text>
    <text x="920" y="400">User-Agent: FranzAI-Bridge/2.0</text>
  </g>

  <!-- Response headers section -->
  <rect x="900" y="420" width="380" height="28" fill="#f1f3f4"/>
  <text x="920" y="438" font-family="system-ui" font-size="11" font-weight="600" fill="#202124">RESPONSE HEADERS</text>

  <g font-family="'Roboto Mono', monospace" font-size="11" fill="#202124">
    <text x="920" y="468">content-type: application/json</text>
    <text x="920" y="488">x-request-id: req_abc123</text>
  </g>

  <!-- Response body section -->
  <rect x="900" y="510" width="380" height="28" fill="#f1f3f4"/>
  <text x="920" y="528" font-family="system-ui" font-size="11" font-weight="600" fill="#202124">RESPONSE BODY</text>

  <rect x="920" y="545" width="340" height="100" rx="4" fill="#f8f9fa"/>
  <g font-family="'Roboto Mono', monospace" font-size="10">
    <text x="930" y="565" fill="#202124">{</text>
    <text x="940" y="580"><tspan fill="#c41a16">"object"</tspan><tspan fill="#202124">: </tspan><tspan fill="#c41a16">"list"</tspan><tspan fill="#202124">,</tspan></text>
    <text x="940" y="595"><tspan fill="#c41a16">"data"</tspan><tspan fill="#202124">: [</tspan></text>
    <text x="950" y="610"><tspan fill="#202124">{ </tspan><tspan fill="#c41a16">"id"</tspan><tspan fill="#202124">: </tspan><tspan fill="#c41a16">"gpt-4"</tspan><tspan fill="#202124"> }</tspan></text>
    <text x="940" y="625" fill="#202124">]</text>
    <text x="930" y="640" fill="#202124">}</text>
  </g>

  <!-- Main page content (code editor mockup) -->
  <rect x="40" y="80" width="820" height="680" rx="8" fill="#1e1e1e"/>
  <g font-family="'Roboto Mono', monospace" font-size="13">
    <text x="60" y="120" fill="#569cd6">const</text><text x="105" y="120" fill="#dcdcaa"> result</text><text x="155" y="120" fill="#d4d4d4"> = </text><text x="175" y="120" fill="#569cd6">await</text><text x="220" y="120" fill="#dcdcaa"> franzai</text><text x="280" y="120" fill="#d4d4d4">.</text><text x="288" y="120" fill="#dcdcaa">fetch</text><text x="325" y="120" fill="#d4d4d4">(</text>
    <text x="80" y="145" fill="#ce9178">'https://api.openai.com/v1/models'</text>
    <text x="60" y="170" fill="#d4d4d4">);</text>
    <text x="60" y="210" fill="#6a9955">// API key auto-injected by FranzAI Bridge!</text>
    <text x="60" y="235" fill="#569cd6">console</text><text x="115" y="235" fill="#d4d4d4">.</text><text x="123" y="235" fill="#dcdcaa">log</text><text x="150" y="235" fill="#d4d4d4">(</text><text x="158" y="235" fill="#9cdcfe">result</text><text x="198" y="235" fill="#d4d4d4">);</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(ASSETS_DIR, "screenshot-1280x800.svg"), svg);
  console.log("Created: screenshot-1280x800.svg");
}

/**
 * Generate all assets and convert to PNG
 */
async function main() {
  console.log("Generating Chrome Web Store marketing assets...\n");

  generateSmallPromo();
  generateLargePromo();
  generateScreenshot();

  console.log("\nSVG assets created in:", ASSETS_DIR);

  // Try to convert to PNG using resvg
  try {
    const { Resvg } = await import("@resvg/resvg-js");

    const files = [
      { name: "promo-small-440x280", width: 440 },
      { name: "promo-large-920x680", width: 920 },
      { name: "screenshot-1280x800", width: 1280 }
    ];

    for (const file of files) {
      const svgPath = path.join(ASSETS_DIR, `${file.name}.svg`);
      const svgContent = fs.readFileSync(svgPath, "utf8");

      const resvg = new Resvg(svgContent, {
        fitTo: { mode: "width", value: file.width }
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      const pngPath = path.join(ASSETS_DIR, `${file.name}.png`);
      fs.writeFileSync(pngPath, pngBuffer);
      console.log(`Converted: ${file.name}.png`);
    }

    console.log("\nAll marketing assets ready for Chrome Web Store submission!");
  } catch (e) {
    console.log("\nTo convert SVGs to PNG, run: npm install @resvg/resvg-js");
    console.log("Then run this script again.");
  }
}

main().catch(console.error);
