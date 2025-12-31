import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

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
        ...devices["Desktop Chrome"],
        // Launch Chrome with extension loaded
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve("./dist")}`,
            `--load-extension=${path.resolve("./dist")}`,
            "--no-sandbox",
            "--disable-setuid-sandbox"
          ]
        }
      }
    }
  ],

  // Build extension before running tests
  webServer: {
    command: "npm run build",
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
