/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import {
  builtinProviderRules,
  expandTemplate,
  hasHeader,
  headersToObject
} from "../src/shared/providers";

describe("providers", () => {
  describe("builtinProviderRules", () => {
    it("returns array of rules", () => {
      const rules = builtinProviderRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });

    it("includes OpenAI rule", () => {
      const rules = builtinProviderRules();
      const openaiRule = rules.find((r) => r.hostPattern === "api.openai.com");
      expect(openaiRule).toBeDefined();
      expect(openaiRule?.injectHeaders?.Authorization).toBe("Bearer ${OPENAI_API_KEY}");
    });

    it("includes Anthropic rule", () => {
      const rules = builtinProviderRules();
      const anthropicRule = rules.find((r) => r.hostPattern === "api.anthropic.com");
      expect(anthropicRule).toBeDefined();
      expect(anthropicRule?.injectHeaders?.["x-api-key"]).toBe("${ANTHROPIC_API_KEY}");
      expect(anthropicRule?.injectHeaders?.["anthropic-version"]).toBe("2023-06-01");
    });

    it("includes Google rule", () => {
      const rules = builtinProviderRules();
      const googleRule = rules.find((r) => r.hostPattern === "generativelanguage.googleapis.com");
      expect(googleRule).toBeDefined();
      expect(googleRule?.injectHeaders?.["x-goog-api-key"]).toBe("${GOOGLE_API_KEY}");
    });

    it("includes Mistral rule", () => {
      const rules = builtinProviderRules();
      const mistralRule = rules.find((r) => r.hostPattern === "api.mistral.ai");
      expect(mistralRule).toBeDefined();
      expect(mistralRule?.injectHeaders?.Authorization).toBe("Bearer ${MISTRAL_API_KEY}");
    });

    it("returns new array each call", () => {
      const rules1 = builtinProviderRules();
      const rules2 = builtinProviderRules();
      expect(rules1).not.toBe(rules2);
    });
  });

  describe("expandTemplate", () => {
    it("expands templates", () => {
      const out = expandTemplate("Bearer ${KEY}", { KEY: "abc" });
      expect(out).toBe("Bearer abc");
    });

    it("expands multiple placeholders", () => {
      const out = expandTemplate("${A}:${B}:${C}", { A: "1", B: "2", C: "3" });
      expect(out).toBe("1:2:3");
    });

    it("replaces missing keys with empty string", () => {
      const out = expandTemplate("Bearer ${MISSING}", {});
      expect(out).toBe("Bearer ");
    });

    it("handles template with no placeholders", () => {
      const out = expandTemplate("static value", { KEY: "ignored" });
      expect(out).toBe("static value");
    });

    it("handles empty template", () => {
      const out = expandTemplate("", { KEY: "value" });
      expect(out).toBe("");
    });

    it("handles underscore in key names", () => {
      const out = expandTemplate("${OPENAI_API_KEY}", { OPENAI_API_KEY: "sk-123" });
      expect(out).toBe("sk-123");
    });

    it("handles numeric key names", () => {
      const out = expandTemplate("${KEY123}", { KEY123: "value" });
      expect(out).toBe("value");
    });

    it("does not expand lowercase keys", () => {
      const out = expandTemplate("${lowercase}", { lowercase: "value" });
      expect(out).toBe("${lowercase}");
    });

    it("handles same key multiple times", () => {
      const out = expandTemplate("${KEY}+${KEY}", { KEY: "x" });
      expect(out).toBe("x+x");
    });

    it("preserves non-matching braces", () => {
      const out = expandTemplate("{ not a template }", { KEY: "value" });
      expect(out).toBe("{ not a template }");
    });
  });

  describe("headersToObject", () => {
    it("returns empty object for undefined", () => {
      const out = headersToObject(undefined);
      expect(out).toEqual({});
    });

    it("normalizes headers from arrays", () => {
      const out = headersToObject([["X-Test", "1"]]);
      expect(out).toEqual({ "X-Test": "1" });
    });

    it("handles multiple array entries", () => {
      const out = headersToObject([
        ["Content-Type", "application/json"],
        ["Authorization", "Bearer token"]
      ]);
      expect(out).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer token"
      });
    });

    it("normalizes headers from Headers object", () => {
      if (typeof Headers === "undefined") return;
      const h = new Headers({ "X-Test": "1" });
      const out = headersToObject(h);
      expect(out).toEqual({ "x-test": "1" }); // Headers normalizes to lowercase
    });

    it("handles multiple headers in Headers object", () => {
      if (typeof Headers === "undefined") return;
      const h = new Headers();
      h.set("Content-Type", "application/json");
      h.set("Authorization", "Bearer token");
      const out = headersToObject(h);
      expect(out["content-type"]).toBe("application/json");
      expect(out["authorization"]).toBe("Bearer token");
    });

    it("normalizes headers from plain object", () => {
      const out = headersToObject({ "X-Test": "value" });
      expect(out).toEqual({ "X-Test": "value" });
    });

    it("converts non-string values to string", () => {
      const out = headersToObject({ Number: 123 as unknown as string });
      expect(out).toEqual({ Number: "123" });
    });

    it("handles empty Headers object", () => {
      if (typeof Headers === "undefined") return;
      const h = new Headers();
      const out = headersToObject(h);
      expect(out).toEqual({});
    });

    it("handles empty array", () => {
      const out = headersToObject([]);
      expect(out).toEqual({});
    });

    it("handles empty object", () => {
      const out = headersToObject({});
      expect(out).toEqual({});
    });
  });

  describe("hasHeader", () => {
    it("matches headers case-insensitively", () => {
      const headers = headersToObject({ Authorization: "Token" });
      expect(hasHeader(headers, "authorization")).toBe(true);
      expect(hasHeader(headers, "AUTHORIZATION")).toBe(true);
      expect(hasHeader(headers, "Authorization")).toBe(true);
    });

    it("returns false for missing header", () => {
      const headers = { "Content-Type": "application/json" };
      expect(hasHeader(headers, "Authorization")).toBe(false);
    });

    it("handles empty headers object", () => {
      expect(hasHeader({}, "Any-Header")).toBe(false);
    });

    it("handles various case patterns", () => {
      const headers = {
        "content-type": "text/html",
        "X-CUSTOM-HEADER": "value"
      };
      expect(hasHeader(headers, "Content-Type")).toBe(true);
      expect(hasHeader(headers, "CONTENT-TYPE")).toBe(true);
      expect(hasHeader(headers, "x-custom-header")).toBe(true);
    });

    it("handles hyphenated header names", () => {
      const headers = { "X-Request-Id": "123" };
      expect(hasHeader(headers, "x-request-id")).toBe(true);
      expect(hasHeader(headers, "X-REQUEST-ID")).toBe(true);
    });
  });
});
