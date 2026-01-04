import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { prepareProfileDir, cleanupProfileDir, describeProfileChoice } from "../scripts/chrome-profile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const useSystemChrome = process.env.PW_USE_SYSTEM_CHROME !== "0";

export type ExtensionContext = {
  context: BrowserContext;
  userDataDir: string;
  cleanup: () => void;
  extensionId: string;
};

const buildArgs = (headlessRequested: boolean) => {
  const args = [
    "--disable-gpu",
    "--no-sandbox",
    "--disable-crashpad",
    "--disable-crash-reporter",
    "--disable-dev-shm-usage",
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
  ];
  if (headlessRequested) args.unshift("--headless=new");
  return args;
};

export const withExtension = async (): Promise<ExtensionContext> => {
  if (!fs.existsSync(dist)) {
    throw new Error("Build dist first (npm run build) before running e2e tests.");
  }
  const profile = prepareProfileDir();
  console.info(`[e2e] Using ${describeProfileChoice(profile)}`);
  const headlessRequested = process.env.PW_EXT_HEADLESS === "1";
  const context = await chromium.launchPersistentContext(profile.userDataDir, {
    ...(useSystemChrome ? { channel: "chrome" } : {}),
    args: buildArgs(headlessRequested),
    // Extensions require full Chrome; keep headed and use --headless=new when requested.
    headless: false
  });
  const cleanup = () => cleanupProfileDir(profile);
  const extensionId = await findExtensionId(context, profile.userDataDir);
  return { context, userDataDir: profile.userDataDir, cleanup, extensionId };
};

export const findExtensionId = async (ctx: BrowserContext, profileDir?: string): Promise<string> => {
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

export async function waitForFranzai(page: Page, timeout = 3000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const hasFranzai = await page.evaluate(() => {
      return typeof (window as unknown as { franzai?: unknown }).franzai !== "undefined";
    });
    if (hasFranzai) return true;
    await page.waitForTimeout(100);
  }
  return false;
}
