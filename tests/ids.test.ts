/// <reference types="vitest" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { makeId } from "../src/shared/ids";

describe("ids", () => {
  describe("makeId", () => {
    it("generates id with prefix using crypto.randomUUID", () => {
      const id = makeId("test");
      expect(id).toMatch(/^test_[a-f0-9-]{36}$/);
    });

    it("generates unique ids", () => {
      const id1 = makeId("req");
      const id2 = makeId("req");
      expect(id1).not.toBe(id2);
    });

    it("uses different prefixes correctly", () => {
      const reqId = makeId("req");
      const logId = makeId("log");
      expect(reqId).toMatch(/^req_/);
      expect(logId).toMatch(/^log_/);
    });

    it("falls back to Date.now + Math.random when crypto unavailable", () => {
      const originalCrypto = globalThis.crypto;

      // Remove crypto
      Object.defineProperty(globalThis, "crypto", {
        value: undefined,
        configurable: true,
        writable: true
      });

      const id = makeId("fallback");
      expect(id).toMatch(/^fallback_\d+_[a-f0-9]+$/);

      // Restore crypto
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
        writable: true
      });
    });

    it("handles empty prefix", () => {
      const id = makeId("");
      expect(id).toMatch(/^_[a-f0-9-]{36}$/);
    });

    it("handles special characters in prefix", () => {
      const id = makeId("test-prefix");
      expect(id).toMatch(/^test-prefix_/);
    });
  });
});
