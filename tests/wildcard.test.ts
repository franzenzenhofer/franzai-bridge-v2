/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { matchesAnyPattern, wildcardToRegExp } from "../src/shared/wildcard";

describe("wildcard", () => {
  describe("wildcardToRegExp", () => {
    it("converts wildcard to regex", () => {
      const re = wildcardToRegExp("*.openai.com");
      expect(re.test("api.openai.com")).toBe(true);
      expect(re.test("deep.api.openai.com")).toBe(true);
      expect(re.test("openai.com")).toBe(false);
    });

    it("matches exact strings", () => {
      const re = wildcardToRegExp("api.openai.com");
      expect(re.test("api.openai.com")).toBe(true);
      expect(re.test("other.openai.com")).toBe(false);
    });

    it("handles multiple wildcards", () => {
      const re = wildcardToRegExp("*.*.example.com");
      expect(re.test("a.b.example.com")).toBe(true);
      expect(re.test("deep.nested.example.com")).toBe(true);
    });

    it("escapes special regex characters", () => {
      const re = wildcardToRegExp("api.example.com");
      expect(re.test("apixexample.com")).toBe(false); // . should not match any char
    });

    it("handles wildcard at end", () => {
      const re = wildcardToRegExp("https://example.com/*");
      expect(re.test("https://example.com/")).toBe(true);
      expect(re.test("https://example.com/path")).toBe(true);
      expect(re.test("https://example.com/path/deep")).toBe(true);
    });

    it("handles wildcard for port", () => {
      const re = wildcardToRegExp("http://localhost:*");
      expect(re.test("http://localhost:3000")).toBe(true);
      expect(re.test("http://localhost:8080")).toBe(true);
      expect(re.test("http://localhost:")).toBe(true);
    });

    it("is case insensitive", () => {
      const re = wildcardToRegExp("API.OPENAI.COM");
      expect(re.test("api.openai.com")).toBe(true);
      expect(re.test("API.OPENAI.COM")).toBe(true);
      expect(re.test("Api.OpenAI.Com")).toBe(true);
    });

    it("trims whitespace from pattern", () => {
      const re = wildcardToRegExp("  api.example.com  ");
      expect(re.test("api.example.com")).toBe(true);
    });

    it("escapes parentheses", () => {
      const re = wildcardToRegExp("example(1).com");
      expect(re.test("example(1).com")).toBe(true);
      expect(re.test("example1.com")).toBe(false);
    });

    it("escapes brackets", () => {
      const re = wildcardToRegExp("example[1].com");
      expect(re.test("example[1].com")).toBe(true);
    });

    it("escapes plus signs", () => {
      const re = wildcardToRegExp("c++.example.com");
      expect(re.test("c++.example.com")).toBe(true);
    });

    // Note: Question marks are NOT escaped in the current implementation
    // They are treated as regex metacharacters (optional preceding char)
    it("handles question marks (not escaped)", () => {
      const re = wildcardToRegExp("example?.com");
      // Since ? is not escaped, "example" becomes optional "e" before "xampl"
      // This matches "examplecom" but also "examplcom"
      expect(re.test("example.com")).toBe(true); // ? makes 'e' optional
      expect(re.test("exampl.com")).toBe(true); // Without the 'e'
    });

    it("handles empty pattern", () => {
      const re = wildcardToRegExp("");
      expect(re.test("")).toBe(true);
      expect(re.test("anything")).toBe(false);
    });

    it("handles pattern with only wildcard", () => {
      const re = wildcardToRegExp("*");
      expect(re.test("anything")).toBe(true);
      expect(re.test("")).toBe(true);
    });
  });

  describe("matchesAnyPattern", () => {
    it("matches patterns", () => {
      expect(matchesAnyPattern("http://localhost:3000", ["http://localhost:*"])).toBe(true);
      expect(
        matchesAnyPattern("https://example.com", ["http://localhost:*", "https://example.com"])
      ).toBe(true);
      expect(matchesAnyPattern("https://nope.com", ["https://example.com"])).toBe(false);
    });

    it("returns false for empty patterns array", () => {
      expect(matchesAnyPattern("https://example.com", [])).toBe(false);
    });

    it("trims input value", () => {
      expect(matchesAnyPattern("  http://localhost:3000  ", ["http://localhost:*"])).toBe(true);
    });

    it("matches first matching pattern", () => {
      expect(
        matchesAnyPattern("https://api.openai.com", [
          "https://blocked.com",
          "*.openai.com",
          "https://api.openai.com"
        ])
      ).toBe(true);
    });

    it("handles pattern matching full URLs", () => {
      expect(
        matchesAnyPattern("https://api.openai.com/v1/chat", [
          "https://api.openai.com/*"
        ])
      ).toBe(true);
    });

    it("handles protocol wildcards", () => {
      expect(matchesAnyPattern("https://example.com", ["*://example.com"])).toBe(true);
      expect(matchesAnyPattern("http://example.com", ["*://example.com"])).toBe(true);
    });

    it("case insensitive matching", () => {
      expect(matchesAnyPattern("HTTPS://EXAMPLE.COM", ["https://example.com"])).toBe(true);
    });

    it("handles multiple wildcards in pattern", () => {
      expect(
        matchesAnyPattern("https://sub.api.example.com/v1/path", ["https://*.example.com/*"])
      ).toBe(true);
    });
  });
});
