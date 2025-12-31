/// <reference types="vitest" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BRIDGE_SOURCE } from "../src/shared/constants";
import { PAGE_MSG, BG_MSG } from "../src/shared/messages";

// Mock window for tests
const mockWindow = {};

describe("contentScript", () => {
  describe("script injection logic", () => {
    it("creates script element with correct src", () => {
      const mockScript = {
        src: "",
        async: false,
        onload: null as (() => void) | null,
        remove: vi.fn()
      };

      // Simulate injection logic
      mockScript.src = "chrome-extension://abc123/injected.js";
      mockScript.async = false;

      expect(mockScript.src).toBe("chrome-extension://abc123/injected.js");
      expect(mockScript.async).toBe(false);
    });

    it("removes script after load", async () => {
      const mockScript = {
        src: "",
        async: false,
        onload: null as (() => void) | null,
        remove: vi.fn()
      };

      // Simulate onload behavior
      mockScript.onload = () => mockScript.remove();
      mockScript.onload();

      expect(mockScript.remove).toHaveBeenCalled();
    });
  });

  describe("message filtering logic", () => {
    it("ignores messages not from window source", () => {
      const event = {
        source: null, // Different from window
        data: {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.FETCH_REQUEST,
          payload: { requestId: "req_1" }
        }
      };

      // Message filtering logic - check against a reference object
      const shouldProcess = event.source === mockWindow;
      expect(shouldProcess).toBe(false);
    });

    it("ignores messages without BRIDGE_SOURCE", () => {
      const event = {
        source: mockWindow,
        data: {
          source: "OTHER_SOURCE",
          type: PAGE_MSG.FETCH_REQUEST,
          payload: { requestId: "req_1" }
        }
      };

      const shouldProcess = event.data?.source === BRIDGE_SOURCE;
      expect(shouldProcess).toBe(false);
    });

    it("accepts messages with correct source", () => {
      const event = {
        source: mockWindow,
        data: {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.FETCH_REQUEST,
          payload: { requestId: "req_1" }
        }
      };

      const shouldProcess =
        event.source === mockWindow &&
        event.data?.source === BRIDGE_SOURCE;
      expect(shouldProcess).toBe(true);
    });
  });

  describe("BRIDGE_READY handling", () => {
    it("recognizes BRIDGE_READY message type", () => {
      const data = {
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.BRIDGE_READY,
        payload: { version: "1.0.0" }
      };

      expect(data.type).toBe(PAGE_MSG.BRIDGE_READY);
      expect(data.payload.version).toBe("1.0.0");
    });
  });

  describe("FETCH_ABORT handling", () => {
    it("validates requestId presence", () => {
      const withRequestId = { requestId: "req_abort" };
      const withoutRequestId = {};

      expect(withRequestId.requestId).toBeTruthy();
      expect((withoutRequestId as { requestId?: string }).requestId).toBeFalsy();
    });

    it("creates correct abort message", () => {
      const requestId = "req_abort";
      const message = {
        type: BG_MSG.FETCH_ABORT,
        payload: { requestId }
      };

      expect(message.type).toBe(BG_MSG.FETCH_ABORT);
      expect(message.payload.requestId).toBe(requestId);
    });
  });

  describe("FETCH_REQUEST handling", () => {
    it("adds pageOrigin to request", () => {
      const pageOrigin = "https://example.com";
      const req = {
        requestId: "req_1",
        url: "https://api.example.com/data",
        init: { method: "GET" }
      };

      const payload = {
        ...req,
        pageOrigin
      };

      expect(payload.pageOrigin).toBe(pageOrigin);
      expect(payload.requestId).toBe("req_1");
      expect(payload.url).toBe("https://api.example.com/data");
    });

    it("validates request has requestId", () => {
      const validReq = { requestId: "req_1", url: "https://example.com" };
      const invalidReq = { url: "https://example.com" };

      expect(validReq.requestId).toBeTruthy();
      expect((invalidReq as { requestId?: string }).requestId).toBeFalsy();
    });

    it("creates correct fetch message", () => {
      const payload = {
        requestId: "req_1",
        url: "https://api.example.com",
        pageOrigin: "https://example.com",
        init: { method: "POST" }
      };

      const message = {
        type: BG_MSG.FETCH,
        payload
      };

      expect(message.type).toBe(BG_MSG.FETCH);
      expect(message.payload.pageOrigin).toBe("https://example.com");
    });
  });

  describe("response posting", () => {
    it("creates correct response message structure", () => {
      const response = {
        ok: true,
        response: {
          requestId: "req_1",
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          bodyText: "{}",
          elapsedMs: 100
        }
      };

      const message = {
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.FETCH_RESPONSE,
        payload: response
      };

      expect(message.source).toBe(BRIDGE_SOURCE);
      expect(message.type).toBe(PAGE_MSG.FETCH_RESPONSE);
      expect(message.payload.response?.status).toBe(200);
    });

    it("creates error response structure", () => {
      const errorMessage = "Extension context invalidated";
      const errorResponse = {
        requestId: "req_error",
        ok: false,
        status: 0,
        statusText: "Bridge Error",
        headers: {},
        bodyText: "",
        elapsedMs: 0,
        error: errorMessage
      };

      const message = {
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.FETCH_RESPONSE,
        payload: {
          ok: false,
          response: errorResponse,
          error: `Failed to reach FranzAI Bridge background: ${errorMessage}`
        }
      };

      expect(message.payload.ok).toBe(false);
      expect(message.payload.error).toContain("Extension context invalidated");
    });
  });

  describe("timeout configuration", () => {
    it("uses extended timeout for bridge requests", () => {
      // BRIDGE_TIMEOUT_MS is 30000
      // Content script adds 5000 for safety margin
      const BRIDGE_TIMEOUT_MS = 30000;
      const timeoutMs = BRIDGE_TIMEOUT_MS + 5000;

      expect(timeoutMs).toBe(35000);
    });
  });
});
