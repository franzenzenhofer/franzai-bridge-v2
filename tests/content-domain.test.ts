import { describe, expect, it } from "vitest";
import { resolveDomain } from "../src/content/domain";

describe("content domain resolution", () => {
  it("prefers direct hostname when available", () => {
    const domain = resolveDomain({
      hostname: "Bridge.FranzAI.com",
      topHostname: "ignored.example.com",
      ancestorOrigin: "https://ignored-ancestor.example.com",
      referrer: "https://ignored-referrer.example.com/page"
    });
    expect(domain).toBe("bridge.franzai.com");
  });

  it("falls back to top frame hostname", () => {
    const domain = resolveDomain({
      hostname: "",
      topHostname: "bridge.franzai.com",
      ancestorOrigin: "https://ignored.example.com",
      referrer: "https://ignored.example.com/page"
    });
    expect(domain).toBe("bridge.franzai.com");
  });

  it("falls back to ancestor origin and then referrer", () => {
    const fromAncestor = resolveDomain({
      hostname: "",
      topHostname: "",
      ancestorOrigin: "https://bridge.franzai.com",
      referrer: "https://referrer.example.com"
    });
    expect(fromAncestor).toBe("bridge.franzai.com");

    const fromReferrer = resolveDomain({
      hostname: "",
      topHostname: "",
      ancestorOrigin: "",
      referrer: "https://bridge.franzai.com/editor/"
    });
    expect(fromReferrer).toBe("bridge.franzai.com");
  });

  it("returns empty string when no signal is usable", () => {
    const domain = resolveDomain({
      hostname: "",
      topHostname: "",
      ancestorOrigin: "not-a-url",
      referrer: "also-not-a-url"
    });
    expect(domain).toBe("");
  });
});
