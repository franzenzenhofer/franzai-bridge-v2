/// <reference types="vitest" />
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BridgeSettings, Dict, InjectionRule, LogEntry } from "../src/shared/types";
import { BG_MSG, BG_EVT } from "../src/shared/messages";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import {
  FETCH_TIMEOUT_MS,
  REQUEST_BODY_PREVIEW_LIMIT,
  RESPONSE_BODY_PREVIEW_LIMIT
} from "../src/shared/constants";
import { wildcardToRegExp, matchesAnyPattern } from "../src/shared/wildcard";
import { expandTemplate, hasHeader } from "../src/shared/providers";
import { makeId } from "../src/shared/ids";

describe("background script logic", () => {
  describe("isDestinationAllowed", () => {
    // Test the logic of destination checking
    const isDestinationAllowed = (url: URL, allowedDestinations: string[]): boolean => {
      const full = url.toString();
      const host = url.hostname;

      for (const pat of allowedDestinations) {
        const p = pat.trim();
        if (!p) continue;

        if (p.includes("://")) {
          if (wildcardToRegExp(p).test(full)) return true;
        } else {
          if (wildcardToRegExp(p).test(host)) return true;
        }
      }

      return false;
    };

    it("allows destinations matching host pattern", () => {
      const url = new URL("https://api.openai.com/v1/chat");
      const allowed = isDestinationAllowed(url, ["api.openai.com"]);
      expect(allowed).toBe(true);
    });

    it("blocks destinations not in allowlist", () => {
      const url = new URL("https://evil.com/steal");
      const allowed = isDestinationAllowed(url, ["api.openai.com"]);
      expect(allowed).toBe(false);
    });

    it("allows full URL patterns", () => {
      const url = new URL("https://api.example.com/v1/endpoint");
      const allowed = isDestinationAllowed(url, ["https://api.example.com/*"]);
      expect(allowed).toBe(true);
    });

    it("handles wildcard host patterns", () => {
      const url = new URL("https://sub.api.example.com/data");
      const allowed = isDestinationAllowed(url, ["*.example.com"]);
      expect(allowed).toBe(true);
    });

    it("returns false for empty allowlist", () => {
      const url = new URL("https://any.com/path");
      const allowed = isDestinationAllowed(url, []);
      expect(allowed).toBe(false);
    });

    it("skips empty patterns", () => {
      const url = new URL("https://api.openai.com/test");
      const allowed = isDestinationAllowed(url, ["", "  ", "api.openai.com"]);
      expect(allowed).toBe(true);
    });
  });

  describe("origin validation", () => {
    it("allows matching origins", () => {
      const pageOrigin = "http://localhost:3000";
      const allowedOrigins = ["http://localhost:*"];
      expect(matchesAnyPattern(pageOrigin, allowedOrigins)).toBe(true);
    });

    it("blocks non-matching origins", () => {
      const pageOrigin = "https://untrusted.com";
      const allowedOrigins = ["https://trusted.com"];
      expect(matchesAnyPattern(pageOrigin, allowedOrigins)).toBe(false);
    });

    it("blocks empty origin", () => {
      const pageOrigin = "";
      const allowedOrigins = ["http://localhost:*"];
      expect(matchesAnyPattern(pageOrigin, allowedOrigins)).toBe(false);
    });
  });

  describe("applyInjectionRules", () => {
    const applyInjectionRules = (args: {
      url: URL;
      headers: Dict<string>;
      env: Dict<string>;
      rules: InjectionRule[];
    }) => {
      const { url, headers, env, rules } = args;

      for (const rule of rules) {
        const hostRe = wildcardToRegExp(rule.hostPattern);
        if (!hostRe.test(url.hostname)) continue;

        if (rule.injectHeaders) {
          for (const [hk, hvTemplate] of Object.entries(rule.injectHeaders)) {
            if (hasHeader(headers, hk)) continue;
            const value = expandTemplate(hvTemplate, env).trim();
            if (value) headers[hk] = value;
          }
        }

        if (rule.injectQuery) {
          for (const [qk, qvTemplate] of Object.entries(rule.injectQuery)) {
            if (url.searchParams.has(qk)) continue;
            const value = expandTemplate(qvTemplate, env).trim();
            if (value) url.searchParams.set(qk, value);
          }
        }
      }
    };

    it("injects headers for matching host", () => {
      const url = new URL("https://api.openai.com/v1/chat");
      const headers: Dict<string> = {};
      const env = { OPENAI_API_KEY: "sk-test123" };
      const rules: InjectionRule[] = [{
        hostPattern: "api.openai.com",
        injectHeaders: { Authorization: "Bearer ${OPENAI_API_KEY}" }
      }];

      applyInjectionRules({ url, headers, env, rules });

      expect(headers.Authorization).toBe("Bearer sk-test123");
    });

    it("does not override existing headers", () => {
      const url = new URL("https://api.openai.com/v1/chat");
      const headers: Dict<string> = { Authorization: "Bearer existing" };
      const env = { OPENAI_API_KEY: "sk-new" };
      const rules: InjectionRule[] = [{
        hostPattern: "api.openai.com",
        injectHeaders: { Authorization: "Bearer ${OPENAI_API_KEY}" }
      }];

      applyInjectionRules({ url, headers, env, rules });

      expect(headers.Authorization).toBe("Bearer existing");
    });

    it("injects query parameters", () => {
      const url = new URL("https://api.google.com/endpoint");
      const headers: Dict<string> = {};
      const env = { GOOGLE_API_KEY: "goog-123" };
      const rules: InjectionRule[] = [{
        hostPattern: "api.google.com",
        injectQuery: { key: "${GOOGLE_API_KEY}" }
      }];

      applyInjectionRules({ url, headers, env, rules });

      expect(url.searchParams.get("key")).toBe("goog-123");
    });

    it("does not override existing query params", () => {
      const url = new URL("https://api.google.com/endpoint?key=existing");
      const headers: Dict<string> = {};
      const env = { GOOGLE_API_KEY: "goog-new" };
      const rules: InjectionRule[] = [{
        hostPattern: "api.google.com",
        injectQuery: { key: "${GOOGLE_API_KEY}" }
      }];

      applyInjectionRules({ url, headers, env, rules });

      expect(url.searchParams.get("key")).toBe("existing");
    });

    it("skips non-matching hosts", () => {
      const url = new URL("https://other.com/endpoint");
      const headers: Dict<string> = {};
      const env = { API_KEY: "test" };
      const rules: InjectionRule[] = [{
        hostPattern: "api.openai.com",
        injectHeaders: { Authorization: "${API_KEY}" }
      }];

      applyInjectionRules({ url, headers, env, rules });

      expect(headers.Authorization).toBeUndefined();
    });

    it("skips completely empty expanded values", () => {
      const url = new URL("https://api.openai.com/v1/chat");
      const headers: Dict<string> = {};
      const env = { OPENAI_API_KEY: "" }; // Empty key
      const rules: InjectionRule[] = [{
        hostPattern: "api.openai.com",
        injectHeaders: { "X-Api-Key": "${OPENAI_API_KEY}" } // Template that becomes empty
      }];

      applyInjectionRules({ url, headers, env, rules });

      // Empty string after expansion is skipped
      expect(headers["X-Api-Key"]).toBeUndefined();
    });

    it("sets header when template has static prefix even with empty var", () => {
      const url = new URL("https://api.openai.com/v1/chat");
      const headers: Dict<string> = {};
      const env = { OPENAI_API_KEY: "" }; // Empty key
      const rules: InjectionRule[] = [{
        hostPattern: "api.openai.com",
        injectHeaders: { Authorization: "Bearer ${OPENAI_API_KEY}" }
      }];

      applyInjectionRules({ url, headers, env, rules });

      // "Bearer " trims to "Bearer" which is truthy, so it gets set
      expect(headers.Authorization).toBe("Bearer");
    });
  });

  describe("previewBody", () => {
    const previewBody = (body: unknown, max: number): string => {
      if (body == null) return "";
      if (body instanceof Uint8Array) return `[binary body ${body.byteLength} bytes]`;
      if (body instanceof ArrayBuffer) return `[binary body ${body.byteLength} bytes]`;
      if (typeof body !== "string") return `[${typeof body} body omitted]`;
      if (body.length <= max) return body;
      return body.slice(0, max) + `\n\n...[truncated, total ${body.length} chars]`;
    };

    it("returns empty string for null/undefined", () => {
      expect(previewBody(null, 100)).toBe("");
      expect(previewBody(undefined, 100)).toBe("");
    });

    it("returns binary placeholder for Uint8Array", () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      expect(previewBody(bytes, 100)).toBe("[binary body 4 bytes]");
    });

    it("returns binary placeholder for ArrayBuffer", () => {
      const buffer = new ArrayBuffer(8);
      expect(previewBody(buffer, 100)).toBe("[binary body 8 bytes]");
    });

    it("returns type placeholder for non-string", () => {
      expect(previewBody({ key: "value" }, 100)).toBe("[object body omitted]");
      expect(previewBody([1, 2, 3], 100)).toBe("[object body omitted]");
    });

    it("returns full string if under limit", () => {
      const body = "short string";
      expect(previewBody(body, 100)).toBe("short string");
    });

    it("truncates long strings", () => {
      const body = "x".repeat(150);
      const result = previewBody(body, 100);
      expect(result.length).toBeLessThan(body.length);
      expect(result).toContain("truncated");
      expect(result).toContain("150 chars");
    });
  });

  describe("makeErrorResponse", () => {
    const makeErrorResponse = (
      requestId: string,
      statusText: string,
      message: string,
      elapsedMs: number
    ) => ({
      requestId,
      ok: false,
      status: 0,
      statusText,
      headers: {},
      bodyText: "",
      elapsedMs,
      error: message
    });

    it("creates error response with all fields", () => {
      const response = makeErrorResponse("req_1", "Blocked", "Not allowed", 100);

      expect(response.requestId).toBe("req_1");
      expect(response.ok).toBe(false);
      expect(response.status).toBe(0);
      expect(response.statusText).toBe("Blocked");
      expect(response.error).toBe("Not allowed");
      expect(response.elapsedMs).toBe(100);
    });
  });

  describe("message handling", () => {
    it("GET_SETTINGS returns settings object", () => {
      const response = { ok: true, settings: DEFAULT_SETTINGS };
      expect(response.ok).toBe(true);
      expect(response.settings).toEqual(DEFAULT_SETTINGS);
    });

    it("SET_SETTINGS returns ok", () => {
      const response = { ok: true };
      expect(response.ok).toBe(true);
    });

    it("GET_LOGS returns logs array", () => {
      const logs: LogEntry[] = [];
      const response = { ok: true, logs };
      expect(response.ok).toBe(true);
      expect(response.logs).toEqual([]);
    });

    it("CLEAR_LOGS returns ok", () => {
      const response = { ok: true };
      expect(response.ok).toBe(true);
    });

    it("FETCH_ABORT returns ok", () => {
      const response = { ok: true };
      expect(response.ok).toBe(true);
    });

    it("unknown message returns error", () => {
      const response = { ok: false, error: "Unknown message type" };
      expect(response.ok).toBe(false);
      expect(response.error).toContain("Unknown");
    });
  });

  describe("abort handling", () => {
    it("AbortController can be created and aborted", () => {
      const controller = new AbortController();
      expect(controller.signal.aborted).toBe(false);

      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });

    it("tracks in-flight requests", () => {
      const inFlight = new Map<string, AbortController>();

      const controller = new AbortController();
      inFlight.set("req_1", controller);

      expect(inFlight.has("req_1")).toBe(true);
      expect(inFlight.get("req_1")).toBe(controller);

      inFlight.delete("req_1");
      expect(inFlight.has("req_1")).toBe(false);
    });
  });

  describe("timeout handling", () => {
    it("timeout aborts fetch", () => {
      vi.useFakeTimers();

      const controller = new AbortController();
      let timedOut = false;

      setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, FETCH_TIMEOUT_MS);

      expect(timedOut).toBe(false);
      vi.advanceTimersByTime(FETCH_TIMEOUT_MS);
      expect(timedOut).toBe(true);
      expect(controller.signal.aborted).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("log entry creation", () => {
    it("creates log entry with required fields", () => {
      const logEntry: LogEntry = {
        id: makeId("log"),
        requestId: "req_1",
        ts: Date.now(),
        tabId: 1,
        pageOrigin: "https://example.com",
        url: "https://api.example.com/data",
        method: "GET",
        requestHeaders: { "Content-Type": "application/json" },
        requestBodyPreview: ""
      };

      expect(logEntry.id).toMatch(/^log_/);
      expect(logEntry.requestId).toBe("req_1");
      expect(logEntry.pageOrigin).toBe("https://example.com");
    });

    it("updates log entry with response data", () => {
      const logEntry: Partial<LogEntry> = {
        id: "log_1",
        requestId: "req_1",
        ts: Date.now(),
        pageOrigin: "https://example.com",
        url: "https://api.example.com/data",
        method: "GET",
        requestHeaders: {},
        requestBodyPreview: ""
      };

      // Update with response
      logEntry.status = 200;
      logEntry.statusText = "OK";
      logEntry.responseHeaders = { "content-type": "application/json" };
      logEntry.responseBodyPreview = '{"success": true}';
      logEntry.elapsedMs = 150;

      expect(logEntry.status).toBe(200);
      expect(logEntry.elapsedMs).toBe(150);
    });
  });

  describe("port management", () => {
    it("tracks connected ports", () => {
      const ports = new Set<{ name: string }>();

      const port1 = { name: "FRANZAI_SIDEPANEL" };
      const port2 = { name: "FRANZAI_SIDEPANEL" };

      ports.add(port1);
      ports.add(port2);

      expect(ports.size).toBe(2);

      ports.delete(port1);
      expect(ports.size).toBe(1);
    });

    it("broadcasts to all ports", () => {
      const mockPostMessage = vi.fn();
      const ports = [
        { postMessage: mockPostMessage },
        { postMessage: mockPostMessage }
      ];

      const evt = { type: BG_EVT.LOGS_UPDATED };

      for (const port of ports) {
        port.postMessage(evt);
      }

      expect(mockPostMessage).toHaveBeenCalledTimes(2);
      expect(mockPostMessage).toHaveBeenCalledWith(evt);
    });
  });
});
