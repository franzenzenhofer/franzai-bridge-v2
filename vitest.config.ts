import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**/*", "node_modules/**/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/sidepanel/**", // Side panel UI - tested via e2e
        "src/background.ts", // Chrome extension entry point - tested via e2e
        "src/contentScript.ts", // Chrome extension entry point - tested via e2e
        "src/injected.ts", // Chrome extension entry point - tested via e2e
        "src/shared/runtime.ts" // Uses chrome.runtime API - tested via e2e
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      }
    },
    // Reset module cache between tests to avoid state leakage
    isolate: true,
    // Increase timeout for tests with async operations
    testTimeout: 10000
  },
  define: {
    __BRIDGE_VERSION__: JSON.stringify("test")
  }
});
