/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from "../src/shared/defaults";

describe("defaults", () => {
  describe("DEFAULT_SETTINGS", () => {
    it("has settingsVersion for auto-migration", () => {
      expect(DEFAULT_SETTINGS.settingsVersion).toBe(SETTINGS_VERSION);
      expect(SETTINGS_VERSION).toBeGreaterThanOrEqual(3);
    });

    it("has allowedOrigins array with wildcard", () => {
      expect(Array.isArray(DEFAULT_SETTINGS.allowedOrigins)).toBe(true);
      expect(DEFAULT_SETTINGS.allowedOrigins.length).toBeGreaterThan(0);
    });

    it("allows ALL origins by default with wildcard", () => {
      expect(DEFAULT_SETTINGS.allowedOrigins).toContain("*");
    });

    it("has allowedDestinations array with wildcard", () => {
      expect(Array.isArray(DEFAULT_SETTINGS.allowedDestinations)).toBe(true);
      expect(DEFAULT_SETTINGS.allowedDestinations.length).toBeGreaterThan(0);
    });

    it("allows ALL destinations by default with wildcard", () => {
      expect(DEFAULT_SETTINGS.allowedDestinations).toContain("*");
    });

    it("has env object with API key placeholders", () => {
      expect(typeof DEFAULT_SETTINGS.env).toBe("object");
      expect(DEFAULT_SETTINGS.env.OPENAI_API_KEY).toBe("");
      expect(DEFAULT_SETTINGS.env.ANTHROPIC_API_KEY).toBe("");
      expect(DEFAULT_SETTINGS.env.GOOGLE_API_KEY).toBe("");
      expect(DEFAULT_SETTINGS.env.MISTRAL_API_KEY).toBe("");
    });

    it("has empty injectionRules array", () => {
      expect(Array.isArray(DEFAULT_SETTINGS.injectionRules)).toBe(true);
      expect(DEFAULT_SETTINGS.injectionRules).toHaveLength(0);
    });

    it("has maxLogs set to 200", () => {
      expect(DEFAULT_SETTINGS.maxLogs).toBe(200);
    });

    it("has all required BridgeSettings fields", () => {
      expect(DEFAULT_SETTINGS).toHaveProperty("settingsVersion");
      expect(DEFAULT_SETTINGS).toHaveProperty("allowedOrigins");
      expect(DEFAULT_SETTINGS).toHaveProperty("allowedDestinations");
      expect(DEFAULT_SETTINGS).toHaveProperty("env");
      expect(DEFAULT_SETTINGS).toHaveProperty("injectionRules");
      expect(DEFAULT_SETTINGS).toHaveProperty("maxLogs");
    });
  });
});
