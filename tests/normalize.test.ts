/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../src/shared/normalize";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { MAX_LOGS_LIMIT, MIN_LOGS_LIMIT } from "../src/shared/constants";

describe("normalizeSettings", () => {
  describe("with undefined/null input", () => {
    it("returns default settings for undefined", () => {
      const out = normalizeSettings(undefined);
      expect(out).toEqual(DEFAULT_SETTINGS);
    });

    it("returns default settings for null", () => {
      const out = normalizeSettings(null);
      expect(out).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe("allowedOrigins", () => {
    it("uses provided allowedOrigins", () => {
      const out = normalizeSettings({
        allowedOrigins: ["https://example.com"]
      });
      expect(out.allowedOrigins).toEqual(["https://example.com"]);
    });

    it("falls back to defaults for invalid allowedOrigins", () => {
      const out = normalizeSettings({
        allowedOrigins: "invalid" as unknown as string[]
      });
      expect(out.allowedOrigins).toEqual(DEFAULT_SETTINGS.allowedOrigins);
    });

    it("filters non-string values from array", () => {
      const out = normalizeSettings({
        allowedOrigins: ["https://valid.com", 123, null, "https://also-valid.com"] as unknown as string[]
      });
      expect(out.allowedOrigins).toEqual(["https://valid.com", "https://also-valid.com"]);
    });

    it("handles empty array", () => {
      const out = normalizeSettings({
        allowedOrigins: []
      });
      expect(out.allowedOrigins).toEqual([]);
    });
  });

  describe("allowedDestinations", () => {
    it("uses provided allowedDestinations", () => {
      const out = normalizeSettings({
        allowedDestinations: ["api.custom.com"]
      });
      expect(out.allowedDestinations).toEqual(["api.custom.com"]);
    });

    it("falls back to defaults for invalid type", () => {
      const out = normalizeSettings({
        allowedDestinations: { invalid: true } as unknown as string[]
      });
      expect(out.allowedDestinations).toEqual(DEFAULT_SETTINGS.allowedDestinations);
    });
  });

  describe("maxLogs", () => {
    it("fills defaults and clamps maxLogs high", () => {
      const out = normalizeSettings({
        allowedOrigins: ["https://example.com"],
        maxLogs: 999999
      });
      expect(out.allowedOrigins).toEqual(["https://example.com"]);
      expect(out.allowedDestinations).toEqual(DEFAULT_SETTINGS.allowedDestinations);
      expect(out.maxLogs).toBe(MAX_LOGS_LIMIT);
    });

    it("clamps low maxLogs", () => {
      const out = normalizeSettings({ maxLogs: 1 });
      expect(out.maxLogs).toBe(MIN_LOGS_LIMIT);
    });

    it("uses default for non-number maxLogs", () => {
      const out = normalizeSettings({ maxLogs: "invalid" as unknown as number });
      expect(out.maxLogs).toBe(DEFAULT_SETTINGS.maxLogs);
    });

    it("uses default for NaN maxLogs", () => {
      const out = normalizeSettings({ maxLogs: NaN });
      expect(out.maxLogs).toBe(DEFAULT_SETTINGS.maxLogs);
    });

    it("floors decimal maxLogs", () => {
      const out = normalizeSettings({ maxLogs: 150.9 });
      expect(out.maxLogs).toBe(150);
    });

    it("keeps valid maxLogs within bounds", () => {
      const out = normalizeSettings({ maxLogs: 500 });
      expect(out.maxLogs).toBe(500);
    });

    it("handles negative maxLogs", () => {
      const out = normalizeSettings({ maxLogs: -100 });
      expect(out.maxLogs).toBe(MIN_LOGS_LIMIT);
    });
  });

  describe("env", () => {
    it("merges env with defaults", () => {
      const out = normalizeSettings({ env: { OPENAI_API_KEY: "abc", EXTRA: "x" } });
      expect(out.env.OPENAI_API_KEY).toBe("abc");
      expect(out.env.EXTRA).toBe("x");
      expect(out.env.ANTHROPIC_API_KEY).toBe(""); // Default
    });

    it("handles empty env", () => {
      const out = normalizeSettings({ env: {} });
      expect(out.env).toEqual(DEFAULT_SETTINGS.env);
    });

    it("filters non-string env values", () => {
      const out = normalizeSettings({
        env: {
          VALID_KEY: "value",
          INVALID_KEY: 123 as unknown as string,
          NULL_KEY: null as unknown as string
        }
      });
      expect(out.env.VALID_KEY).toBe("value");
      expect(out.env.INVALID_KEY).toBeUndefined();
      expect(out.env.NULL_KEY).toBeUndefined();
    });

    it("handles invalid env type", () => {
      const out = normalizeSettings({ env: "invalid" as unknown as Record<string, string> });
      expect(out.env).toEqual(DEFAULT_SETTINGS.env);
    });
  });

  describe("injectionRules", () => {
    it("parses valid injection rules", () => {
      const out = normalizeSettings({
        injectionRules: [
          {
            hostPattern: "api.example.com",
            injectHeaders: { Authorization: "Bearer token" }
          }
        ]
      });
      expect(out.injectionRules).toHaveLength(1);
      expect(out.injectionRules[0].hostPattern).toBe("api.example.com");
      expect(out.injectionRules[0].injectHeaders).toEqual({ Authorization: "Bearer token" });
    });

    it("returns empty array for invalid injectionRules type", () => {
      const out = normalizeSettings({
        injectionRules: "invalid" as unknown as []
      });
      expect(out.injectionRules).toEqual([]);
    });

    it("filters rules without hostPattern", () => {
      const out = normalizeSettings({
        injectionRules: [
          { injectHeaders: { key: "value" } } as unknown as { hostPattern: string },
          { hostPattern: "valid.com", injectHeaders: { key: "value" } }
        ]
      });
      expect(out.injectionRules).toHaveLength(1);
      expect(out.injectionRules[0].hostPattern).toBe("valid.com");
    });

    it("filters non-string hostPattern", () => {
      const out = normalizeSettings({
        injectionRules: [
          { hostPattern: 123 as unknown as string, injectHeaders: { key: "value" } }
        ]
      });
      expect(out.injectionRules).toEqual([]);
    });

    it("handles rules with injectQuery", () => {
      const out = normalizeSettings({
        injectionRules: [
          {
            hostPattern: "api.google.com",
            injectQuery: { key: "${API_KEY}" }
          }
        ]
      });
      expect(out.injectionRules[0].injectQuery).toEqual({ key: "${API_KEY}" });
    });

    it("handles null items in rules array", () => {
      const out = normalizeSettings({
        injectionRules: [
          null,
          { hostPattern: "valid.com" },
          undefined
        ] as unknown as []
      });
      expect(out.injectionRules).toHaveLength(1);
    });

    it("normalizes injectHeaders dictionary", () => {
      const out = normalizeSettings({
        injectionRules: [
          {
            hostPattern: "api.example.com",
            injectHeaders: {
              valid: "string",
              invalid: 123 as unknown as string
            }
          }
        ]
      });
      expect(out.injectionRules[0].injectHeaders).toEqual({ valid: "string" });
    });
  });

  describe("complete settings object", () => {
    it("returns complete settings object with all fields", () => {
      const out = normalizeSettings({
        allowedOrigins: ["https://test.com"],
        allowedDestinations: ["api.test.com"],
        env: { CUSTOM: "value" },
        injectionRules: [{ hostPattern: "*.test.com" }],
        maxLogs: 100
      });

      expect(out).toHaveProperty("allowedOrigins");
      expect(out).toHaveProperty("allowedDestinations");
      expect(out).toHaveProperty("env");
      expect(out).toHaveProperty("injectionRules");
      expect(out).toHaveProperty("maxLogs");
    });
  });
});
