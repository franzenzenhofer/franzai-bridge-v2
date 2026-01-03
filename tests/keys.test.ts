/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { getConfiguredKeyNames, normalizeKeyName, resolveKeyValue } from "../src/shared/keys";

describe("getConfiguredKeyNames", () => {
  it("returns names with non-empty values", () => {
    const env = {
      OPENAI_API_KEY: "sk-test",
      ANTHROPIC_API_KEY: "  ",
      GOOGLE_API_KEY: "",
      MISTRAL_API_KEY: "mistral"
    };

    expect(getConfiguredKeyNames(env)).toEqual(["OPENAI_API_KEY", "MISTRAL_API_KEY"]);
  });

  it("returns empty array when no keys are set", () => {
    const env = {
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: " ",
      GOOGLE_API_KEY: ""
    };

    expect(getConfiguredKeyNames(env)).toEqual([]);
  });

  it("normalizes Gemini alias to Google", () => {
    expect(normalizeKeyName("GEMINI_API_KEY")).toBe("GOOGLE_API_KEY");
  });

  it("exposes Google when only Gemini is set", () => {
    const env = { GEMINI_API_KEY: "legacy" };
    expect(resolveKeyValue(env, "GOOGLE_API_KEY")).toBe("legacy");
    expect(getConfiguredKeyNames(env)).toEqual(["GOOGLE_API_KEY"]);
  });
});
