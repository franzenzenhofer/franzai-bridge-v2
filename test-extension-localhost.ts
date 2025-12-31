/**
 * Live extension test on LOCALHOST - launches Chrome with extension
 * Run with: npx tsx test-extension-localhost.ts
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "dist");
const demoDir = path.resolve(__dirname, "demo");

// Simple static file server
function startServer(port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(demoDir, req.url === "/" ? "simple-test.html" : req.url!);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const contentType = ext === ".html" ? "text/html" : ext === ".js" ? "application/javascript" : "text/plain";
        res.writeHead(200, { "Content-Type": contentType });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(port, () => {
      console.log(`✓ Local server started on http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function main() {
  console.log("🚀 Starting LOCALHOST extension test...\n");

  // Check dist exists
  if (!fs.existsSync(dist)) {
    console.error("❌ dist folder not found! Run: npm run build");
    process.exit(1);
  }
  console.log("✓ Found dist folder:", dist);

  // Start local server
  const server = await startServer(9999);

  // Create temp profile
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "franzai-test-"));
  console.log("✓ Created temp profile:", userDataDir);

  // Launch browser with extension
  const args = [
    "--disable-gpu",
    "--no-sandbox",
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
  ];

  console.log("✓ Launching Chrome with extension...\n");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Show browser!
    args,
  });

  // Wait for extension to load
  console.log("⏳ Waiting for extension service worker...");
  const sw = await context.waitForEvent("serviceworker", { timeout: 10000 }).catch(() => null);

  let extensionId = "";
  if (sw) {
    const m = sw.url().match(/chrome-extension:\/\/([a-z]+)\//);
    if (m) extensionId = m[1];
  }

  if (extensionId) {
    console.log("✓ Extension loaded! ID:", extensionId);
  } else {
    console.log("⚠ Could not get extension ID from service worker");
  }

  // Configure extension to allow localhost
  console.log("\n📝 Configuring extension settings...");
  const bgPage = await context.newPage();

  if (extensionId) {
    await bgPage.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    await bgPage.waitForTimeout(1000);

    const cdp = await context.newCDPSession(bgPage);
    await cdp.send("Runtime.evaluate", {
      expression: `
        (async () => {
          const settings = {
            allowedOrigins: ["http://localhost:*", "https://localhost:*"],
            allowedDestinations: ["*"],
            env: {},
            injectionRules: [],
            maxLogs: 100
          };
          await chrome.storage.local.set({ franzaiSettings: settings });
          return "settings configured";
        })()
      `,
      awaitPromise: true
    });
    console.log("✓ Extension configured for localhost");
  }

  // Open test page on LOCALHOST
  console.log("\n🌐 Opening test page on localhost:9999...");
  const testPage = await context.newPage();

  await testPage.goto("http://localhost:9999/simple-test.html");
  await testPage.waitForTimeout(2000);

  // Reload to ensure content script injects
  await testPage.reload();
  await testPage.waitForTimeout(2000);

  // Check if extension is detected
  console.log("\n🔍 Checking extension detection...");
  const result = await testPage.evaluate(() => {
    return {
      franzaiExists: typeof (window as any).franzai !== "undefined",
      franzaiType: typeof (window as any).franzai,
      hasping: typeof (window as any).franzai?.ping === "function",
      hasSetMode: typeof (window as any).franzai?.setMode === "function",
      hasGetMode: typeof (window as any).franzai?.getMode === "function",
    };
  });

  console.log("\n" + "=".repeat(50));
  console.log("📊 EXTENSION DETECTION RESULTS:");
  console.log("=".repeat(50));
  console.log(`window.franzai exists:  ${result.franzaiExists ? "✅ YES" : "❌ NO"}`);
  console.log(`franzai.ping exists:    ${result.hasping ? "✅ YES" : "❌ NO"}`);
  console.log(`franzai.setMode exists: ${result.hasSetMode ? "✅ YES" : "❌ NO"}`);
  console.log(`franzai.getMode exists: ${result.hasGetMode ? "✅ YES" : "❌ NO"}`);
  console.log("=".repeat(50) + "\n");

  if (result.franzaiExists) {
    console.log("🎉 SUCCESS! Extension IS DETECTED on localhost!\n");

    // Test actual CORS bypass
    console.log("🧪 Testing CORS bypass with httpbin.org...");
    await testPage.evaluate(() => {
      (window as any).franzai?.setMode("always");
    });

    const corsResult = await testPage.evaluate(async () => {
      try {
        const response = await fetch("https://httpbin.org/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: "cors-bypass", timestamp: Date.now() })
        });
        const data = await response.json();
        return { success: true, status: response.status, data };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    });

    console.log("\n" + "=".repeat(50));
    console.log("📊 CORS BYPASS RESULTS:");
    console.log("=".repeat(50));
    if (corsResult.success) {
      console.log("✅ CORS BYPASS WORKING!");
      console.log(`Status: ${corsResult.status}`);
      console.log(`Response received: ${JSON.stringify(corsResult.data).substring(0, 100)}...`);
    } else {
      console.log("❌ CORS bypass failed:", corsResult.error);
    }
    console.log("=".repeat(50) + "\n");

  } else {
    console.log("❌ FAILED: Extension not detected on localhost\n");
  }

  // Take screenshot
  const screenshotPath = path.resolve(__dirname, "test-result-localhost.png");
  await testPage.screenshot({ path: screenshotPath });
  console.log("📸 Screenshot saved:", screenshotPath);

  // Cleanup
  console.log("\n🧹 Cleaning up...");
  await context.close();
  server.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });

  console.log("✓ Done!\n");

  // Exit with appropriate code
  process.exit(result.franzaiExists ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
