/**
 * Live extension test - launches Chrome with extension and tests it
 * Run with: npx tsx test-extension-live.ts
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "dist");

async function main() {
  console.log("🚀 Starting live extension test...\n");

  // Check dist exists
  if (!fs.existsSync(dist)) {
    console.error("❌ dist folder not found! Run: npm run build");
    process.exit(1);
  }
  console.log("✓ Found dist folder:", dist);

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

  // Start local server
  console.log("\n🌐 Opening test page...");
  const testPage = await context.newPage();

  // Navigate to test page
  const testPagePath = path.resolve(__dirname, "demo/simple-test.html");
  await testPage.goto(`file://${testPagePath}`);
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

  console.log("\n📊 RESULTS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`window.franzai exists: ${result.franzaiExists ? "✅ YES" : "❌ NO"}`);
  console.log(`franzai.ping exists:   ${result.hasping ? "✅ YES" : "❌ NO"}`);
  console.log(`franzai.setMode exists: ${result.hasSetMode ? "✅ YES" : "❌ NO"}`);
  console.log(`franzai.getMode exists: ${result.hasGetMode ? "✅ YES" : "❌ NO"}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (result.franzaiExists) {
    console.log("🎉 SUCCESS! Extension is working!\n");

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
          body: JSON.stringify({ test: "cors-bypass" })
        });
        const data = await response.json();
        return { success: true, status: response.status, data };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    });

    if (corsResult.success) {
      console.log("✅ CORS bypass working! Status:", corsResult.status);
    } else {
      console.log("❌ CORS bypass failed:", corsResult.error);
    }
  } else {
    console.log("❌ FAILED: Extension not detected\n");
    console.log("Note: file:// URLs may not work. Try with localhost server.");
  }

  // Take screenshot
  const screenshotPath = path.resolve(__dirname, "test-result.png");
  await testPage.screenshot({ path: screenshotPath });
  console.log("\n📸 Screenshot saved:", screenshotPath);

  // Keep browser open for inspection
  console.log("\n👀 Browser is open for inspection. Press Ctrl+C to close.");

  // Wait indefinitely (user will Ctrl+C)
  await new Promise(() => {});
}

main().catch(console.error);
