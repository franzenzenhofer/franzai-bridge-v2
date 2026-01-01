import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { prepareProfileDir, cleanupProfileDir, describeProfileChoice } from "../scripts/chrome-profile";

/**
 * E2E tests for the Demo Page
 *
 * These tests verify that the demo page works correctly with the extension
 * and that all features are functional.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const demoPath = path.resolve(__dirname, "../demo/index.html");
const demoUrl = "http://localhost:8765/demo/index.html";
const demoHtml = fs.readFileSync(demoPath, "utf8");
const demoRoutes = new WeakSet<BrowserContext>();

type ExtensionContext = {
  context: BrowserContext;
  userDataDir: string;
  cleanup: () => void;
  extensionId: string;
};

const buildArgs = (headless: boolean) => {
  const args = [
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
  ];
  if (headless) args.unshift("--headless=new");
  return args;
};

const withExtension = async (): Promise<ExtensionContext> => {
  if (!fs.existsSync(dist)) {
    throw new Error("Build dist first (npm run build) before running e2e tests.");
  }
  const profile = prepareProfileDir();
  console.info(`[e2e] Using ${describeProfileChoice(profile)}`);
  const headlessRequested = process.env.PW_EXT_HEADLESS !== "0";
  const context = await chromium.launchPersistentContext(profile.userDataDir, {
    args: buildArgs(headlessRequested),
    headless: false
  });
  const cleanup = () => cleanupProfileDir(profile);
  const extensionId = await findExtensionId(context, profile.userDataDir);
  return { context, userDataDir: profile.userDataDir, cleanup, extensionId };
};

const findExtensionId = async (ctx: BrowserContext, profileDir?: string): Promise<string> => {
  const sw = ctx.serviceWorkers();
  for (const w of sw) {
    const url = w.url();
    const m = url.match(/^chrome-extension:\/\/([a-z]+)\//);
    if (m) return m[1];
  }
  const w = await ctx.waitForEvent("serviceworker", { timeout: 10_000 }).catch(() => null);
  if (w) {
    const m = w.url().match(/^chrome-extension:\/\/([a-z]+)\//);
    if (m) return m[1];
  }
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const { targetInfos } = await cdp.send("Target.getTargets") as { targetInfos: { url: string }[] };
  await p.close();
  const ti = targetInfos.find((t) => t.url.startsWith("chrome-extension://"));
  if (!ti) {
    const byPrefs = profileDir ? readExtensionIdFromPreferences(profileDir) : null;
    if (byPrefs) return byPrefs;
    throw new Error("Extension target not found");
  }
  const m = ti.url.match(/^chrome-extension:\/\/([a-z]+)\//);
  if (!m) throw new Error("Extension ID not found in target URL");
  return m[1];
};

const readExtensionIdFromPreferences = (profileDir: string): string | null => {
  const prefPath = path.join(profileDir, "Default", "Preferences");
  if (!fs.existsSync(prefPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(prefPath, "utf8")) as {
      extensions?: { settings?: Record<string, { path?: string }> };
    };
    const settings = raw.extensions?.settings || {};
    for (const [id, info] of Object.entries(settings)) {
      if (!info?.path) continue;
      if (path.resolve(info.path) === dist) return id;
    }
  } catch (err) {
    console.warn("[e2e] Failed to read Preferences for extension id", err);
  }
  return null;
};

const ensureDemoRoute = async (ctx: BrowserContext): Promise<void> => {
  if (demoRoutes.has(ctx)) return;
  demoRoutes.add(ctx);

  await ctx.route("http://localhost:8765/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/demo") || url.endsWith("/demo/") || url.endsWith("/demo/index.html")) {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: demoHtml
      });
      return;
    }
    if (url.endsWith("/favicon.ico")) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({ status: 404, contentType: "text/plain", body: "Not found" });
  });
};

const openDemoPage = async (ctx: BrowserContext): Promise<import("@playwright/test").Page> => {
  await ensureDemoRoute(ctx);
  const page = await ctx.newPage();
  await page.goto(demoUrl, { waitUntil: "load", timeout: 10_000 });
  return page;
};

const configureExtensionForDemo = async (ctx: BrowserContext, extensionId: string): Promise<void> => {
  const bgPage = await ctx.newPage();
  await bgPage.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
  await bgPage.waitForTimeout(500);

  const cdp = await ctx.newCDPSession(bgPage);
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
        await chrome.runtime.sendMessage({
          type: "FRANZAI_SET_DOMAIN_ENABLED",
          payload: { domain: "localhost", enabled: true }
        });
        return "ok";
      })()
    `,
    awaitPromise: true
  });
  await bgPage.close();
};

test.describe("Demo Page", () => {
  test("demo page loads and shows ready status", async () => {
    const { context: ctx, cleanup, extensionId } = await withExtension();
    try {
      await configureExtensionForDemo(ctx, extensionId);
      const demoPage = await openDemoPage(ctx);
      await demoPage.waitForFunction(
        () => document.getElementById("statusText")?.textContent?.includes("Ready"),
        null,
        { timeout: 10_000 }
      );

      const statusText = await demoPage.locator("#statusText").textContent();
      expect(statusText).toContain("Ready");
      await expect(demoPage.locator(".input-panel")).toBeVisible();
    } finally {
      await ctx.close();
      cleanup();
    }
  });

  test("demo page sends request and logs result", async () => {
    const { context: ctx, cleanup, extensionId } = await withExtension();
    try {
      await configureExtensionForDemo(ctx, extensionId);
      const demoPage = await openDemoPage(ctx);
      await demoPage.waitForFunction(
        () => document.getElementById("statusText")?.textContent?.includes("Ready"),
        null,
        { timeout: 10_000 }
      );

      await demoPage.selectOption("#provider", "httpbin");
      await demoPage.fill("#prompt", "Hello from e2e");
      await demoPage.click("#sendBtn");

      const statusCell = demoPage.locator(".log-item .status").first();
      await expect(statusCell).toHaveText(/\d{3}/, { timeout: 15_000 });
      expect(await statusCell.textContent()).toBe("200");
    } finally {
      await ctx.close();
      cleanup();
    }
  });
});
