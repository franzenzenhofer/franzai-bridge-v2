/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import {
  BRIDGE_SOURCE,
  BRIDGE_VERSION,
  BRIDGE_TIMEOUT_MS,
  FETCH_TIMEOUT_MS,
  MAX_BODY_BYTES,
  REQUEST_BODY_PREVIEW_LIMIT,
  RESPONSE_BODY_PREVIEW_LIMIT,
  MIN_LOGS_LIMIT,
  MAX_LOGS_LIMIT,
  RUNTIME_MESSAGE_TIMEOUT_MS
} from "../src/shared/constants";

describe("constants", () => {
  describe("BRIDGE_SOURCE", () => {
    it("is defined", () => {
      expect(BRIDGE_SOURCE).toBe("FRANZAI_BRIDGE");
    });
  });

  describe("BRIDGE_VERSION", () => {
    it("is defined (from vitest config)", () => {
      expect(BRIDGE_VERSION).toBe("test");
    });
  });

  describe("timeout constants", () => {
    it("BRIDGE_TIMEOUT_MS is 30 seconds", () => {
      expect(BRIDGE_TIMEOUT_MS).toBe(30_000);
    });

    it("FETCH_TIMEOUT_MS is 25 seconds", () => {
      expect(FETCH_TIMEOUT_MS).toBe(25_000);
    });

    it("RUNTIME_MESSAGE_TIMEOUT_MS is 15 seconds", () => {
      expect(RUNTIME_MESSAGE_TIMEOUT_MS).toBe(15_000);
    });

    it("FETCH_TIMEOUT_MS is less than BRIDGE_TIMEOUT_MS", () => {
      expect(FETCH_TIMEOUT_MS).toBeLessThan(BRIDGE_TIMEOUT_MS);
    });
  });

  describe("body size limits", () => {
    it("MAX_BODY_BYTES is 5MB", () => {
      expect(MAX_BODY_BYTES).toBe(5 * 1024 * 1024);
    });

    it("REQUEST_BODY_PREVIEW_LIMIT is 25KB", () => {
      expect(REQUEST_BODY_PREVIEW_LIMIT).toBe(25_000);
    });

    it("RESPONSE_BODY_PREVIEW_LIMIT is 50KB", () => {
      expect(RESPONSE_BODY_PREVIEW_LIMIT).toBe(50_000);
    });

    it("preview limits are less than max body bytes", () => {
      expect(REQUEST_BODY_PREVIEW_LIMIT).toBeLessThan(MAX_BODY_BYTES);
      expect(RESPONSE_BODY_PREVIEW_LIMIT).toBeLessThan(MAX_BODY_BYTES);
    });
  });

  describe("log limits", () => {
    it("MIN_LOGS_LIMIT is 10", () => {
      expect(MIN_LOGS_LIMIT).toBe(10);
    });

    it("MAX_LOGS_LIMIT is 1000", () => {
      expect(MAX_LOGS_LIMIT).toBe(1000);
    });

    it("MIN is less than MAX", () => {
      expect(MIN_LOGS_LIMIT).toBeLessThan(MAX_LOGS_LIMIT);
    });
  });
});
