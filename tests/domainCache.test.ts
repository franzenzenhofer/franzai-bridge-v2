/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import type { BridgeStatus } from "../src/shared/types";
import {
  applyDomainEnabledUpdate,
  getCachedDomainEnabled,
  initDomainStatusCache,
  setDomainStatus
} from "../src/shared/domainCache";

function makeStatus(overrides: Partial<BridgeStatus> = {}): BridgeStatus {
  return {
    installed: true,
    version: "test",
    domainEnabled: true,
    domainSource: "user",
    originAllowed: true,
    hasApiKeys: true,
    ready: true,
    reason: "ok",
    ...overrides
  };
}

describe("domain status cache", () => {
  it("initializes empty cache", () => {
    const cache = initDomainStatusCache();
    expect(cache.status).toBeNull();
    expect(cache.enabledOverride).toBeNull();
    expect(getCachedDomainEnabled(cache)).toBeNull();
  });

  it("returns status value when override is unset", () => {
    const cache = initDomainStatusCache();
    setDomainStatus(cache, makeStatus({ domainEnabled: false }));
    expect(getCachedDomainEnabled(cache)).toBe(false);
  });

  it("returns override when set before status exists", () => {
    const cache = initDomainStatusCache();
    applyDomainEnabledUpdate(cache, { enabled: false, source: "user" });
    expect(cache.status).toBeNull();
    expect(cache.enabledOverride).toBe(false);
    expect(getCachedDomainEnabled(cache)).toBe(false);
  });

  it("updates existing status and clears override", () => {
    const cache = initDomainStatusCache();
    setDomainStatus(cache, makeStatus({ domainEnabled: true, domainSource: "user" }));
    cache.enabledOverride = false;

    applyDomainEnabledUpdate(cache, { enabled: false, source: "meta" });

    expect(cache.status?.domainEnabled).toBe(false);
    expect(cache.status?.domainSource).toBe("meta");
    expect(cache.enabledOverride).toBeNull();
  });

  it("defaults invalid source to default", () => {
    const cache = initDomainStatusCache();
    setDomainStatus(cache, makeStatus({ domainEnabled: true, domainSource: "user" }));
    applyDomainEnabledUpdate(cache, { enabled: false, source: "invalid" });
    expect(cache.status?.domainSource).toBe("default");
  });
});
