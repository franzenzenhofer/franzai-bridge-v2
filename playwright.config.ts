import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();
// Default to headless to avoid stealing focus during local work.
// Set PW_EXT_HEADLESS=0 to force headed mode.
const headlessRequested = process.env.PW_EXT_HEADLESS !== "0";
const useSystemChrome = process.env.PW_USE_SYSTEM_CHROME === "1";

/**
 * Playwright configuration for e2e testing Chrome extension
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Extensions require sequential testing
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension testing
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60000, // Longer timeout for extension loading

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },

  projects: [
    {
      name: "chromium-extension",
      use: {
        headless: headlessRequested,
        ...devices["Desktop Chrome"],
        // Launch Chrome with extension loaded
        launchOptions: {
          ...(useSystemChrome ? { channel: "chrome" } : {}),
          args: [
            ...(headlessRequested ? ["--headless=new"] : []),
            `--disable-extensions-except=${path.resolve("./dist")}`,
            `--load-extension=${path.resolve("./dist")}`,
            "--disable-crashpad",
            "--disable-crash-reporter",
            "--no-sandbox",
            "--disable-setuid-sandbox"
          ]
        }
      }
    }
  ],

  // Build extension before running tests
  webServer: {
    command: "npm run build:nobump && npm run build:editor",
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
