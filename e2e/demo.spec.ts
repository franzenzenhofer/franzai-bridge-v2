import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type BrowserContext } from "@playwright/test";
import { withExtension } from "./extension-helpers";

/**
 * E2E tests for the Demo Page
 *
 * These tests verify that the demo page works correctly with the extension
 * and that all features are functional.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoPath = path.resolve(__dirname, "../demo/index.html");
const demoUrl = "http://localhost:8765/demo/index.html";
const demoHtml = fs.readFileSync(demoPath, "utf8");
const demoRoutes = new WeakSet<BrowserContext>();

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
