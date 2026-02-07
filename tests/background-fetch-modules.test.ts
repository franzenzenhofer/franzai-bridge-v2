import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import type { BridgeSettings, FetchRequestFromPage, LogEntry } from "../src/shared/types";
import { buildRequestContext } from "../src/background/fetch/request";
import { isBinaryBody, decodeBinaryBody } from "../src/background/fetch/body";
import { previewBody } from "../src/background/fetch/preview";
import { readResponse, applyResponseToLog } from "../src/background/fetch/response";
import { clearCache, getCachedResponse, setCachedResponse } from "../src/background/fetch/cache";
import { abortFetch, clearInFlight, trackInFlight, wasAbortedByPage } from "../src/background/fetch/state";

function makeSettings(overrides: Partial<BridgeSettings> = {}): BridgeSettings {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    ...overrides,
    env: {
      ...structuredClone(DEFAULT_SETTINGS).env,
      ...(overrides.env ?? {})
    },
    injectionRules: overrides.injectionRules ?? [],
    allowedOrigins: overrides.allowedOrigins ?? ["*"],
    allowedDestinations: overrides.allowedDestinations ?? ["*"]
  };
}

describe("background fetch modules", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearCache();
    clearInFlight("req-state");
    clearInFlight("req-state-unknown");
  });

  describe("buildRequestContext", () => {
    it("injects built-in OpenAI header and builds a fetch init", () => {
      const settings = makeSettings({
        allowedDestinations: ["api.openai.com"],
        env: { OPENAI_API_KEY: "sk-test" }
      });

      const payload: FetchRequestFromPage = {
        requestId: "req-1",
        pageOrigin: "https://app.example.com",
        url: "https://api.openai.com/v1/chat/completions",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "user", content: "Hi" }] })
        }
      };

      const result = buildRequestContext(payload, settings, 9);
      expect(result.ok).toBe(true);

      if (!result.ok) return;
      expect(result.ctx.method).toBe("POST");
      expect(result.ctx.requestHeaders.Authorization).toBe("Bearer sk-test");
      expect(result.ctx.logEntry.tabId).toBe(9);
      expect(result.ctx.logEntry.requestBodyPreview).toContain("gpt-5-mini");
    });

    it("does not overwrite existing authorization header", () => {
      const settings = makeSettings({
        allowedDestinations: ["api.openai.com"],
        env: { OPENAI_API_KEY: "sk-ignored" }
      });

      const payload: FetchRequestFromPage = {
        requestId: "req-2",
        pageOrigin: "https://app.example.com",
        url: "https://api.openai.com/v1/chat/completions",
        init: {
          method: "POST",
          headers: { authorization: "Bearer existing" }
        }
      };

      const result = buildRequestContext(payload, settings, undefined);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.ctx.requestHeaders.authorization).toBe("Bearer existing");
      expect(result.ctx.requestHeaders.Authorization).toBeUndefined();
    });

    it("blocks invalid URL and blocked destination", () => {
      const blockedSettings = makeSettings({ allowedDestinations: ["api.mistral.ai"] });

      const invalidUrlPayload: FetchRequestFromPage = {
        requestId: "req-3",
        pageOrigin: "https://app.example.com",
        url: "not-a-url"
      };
      const invalidResult = buildRequestContext(invalidUrlPayload, blockedSettings, undefined);
      expect(invalidResult.ok).toBe(false);
      if (invalidResult.ok) return;
      expect(invalidResult.statusText).toBe("Bad URL");

      const blockedPayload: FetchRequestFromPage = {
        requestId: "req-4",
        pageOrigin: "https://app.example.com",
        url: "https://api.openai.com/v1/models"
      };
      const blockedResult = buildRequestContext(blockedPayload, blockedSettings, undefined);
      expect(blockedResult.ok).toBe(false);
      if (blockedResult.ok) return;
      expect(blockedResult.statusText).toBe("Blocked");
      expect(blockedResult.message).toContain("destination not allowed");
    });

    it("decodes binary body into Uint8Array", () => {
      const settings = makeSettings({ allowedDestinations: ["api.example.com"] });
      const payload: FetchRequestFromPage = {
        requestId: "req-5",
        pageOrigin: "https://app.example.com",
        url: "https://api.example.com/upload",
        init: {
          method: "POST",
          body: {
            __binary: true,
            base64: "AQIDBA==",
            byteLength: 4
          }
        }
      };

      const result = buildRequestContext(payload, settings, undefined);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const body = result.ctx.fetchInit.body;
      expect(body).toBeInstanceOf(Uint8Array);
      expect(Array.from(body as Uint8Array)).toEqual([1, 2, 3, 4]);
    });
  });

  describe("body + preview helpers", () => {
    it("identifies and decodes binary body", () => {
      const binary = { __binary: true as const, base64: "SGVsbG8=", byteLength: 5 };
      expect(isBinaryBody(binary)).toBe(true);
      expect(Array.from(decodeBinaryBody(binary))).toEqual([72, 101, 108, 108, 111]);
    });

    it("builds useful body previews", () => {
      expect(previewBody(undefined, 50)).toBe("");
      expect(previewBody({ foo: "bar" }, 50)).toBe("[object body omitted]");
      expect(previewBody(new Uint8Array([1, 2, 3]), 50)).toBe("[binary body 3 bytes]");
      expect(previewBody("x".repeat(60), 20)).toContain("truncated");
    });
  });

  describe("response reader", () => {
    it("reads textual responses", async () => {
      const res = new Response(JSON.stringify({ ok: true }), {
        status: 201,
        statusText: "Created",
        headers: {
          "content-type": "application/json",
          "x-request-id": "r-1"
        }
      });

      const result = await readResponse({
        requestId: "req-text",
        res,
        started: Date.now() - 5
      });

      expect(result.response.requestId).toBe("req-text");
      expect(result.response.status).toBe(201);
      expect(result.response.bodyText).toContain("ok");
      expect(result.response.bodyBytes).toBeUndefined();
      expect(result.responseHeaders["x-request-id"]).toBe("r-1");
      expect(result.eventStream).toBe(false);
    });

    it("reads binary responses and flags event streams", async () => {
      const bytes = new Uint8Array([9, 8, 7]);
      const binaryRes = new Response(bytes, {
        status: 200,
        headers: { "content-type": "application/octet-stream" }
      });

      const binary = await readResponse({
        requestId: "req-bin",
        res: binaryRes,
        started: Date.now() - 3
      });

      expect(binary.response.bodyText).toBe("");
      expect(binary.response.bodyBytes).toEqual(bytes);
      expect(binary.bodyPreview).toBe("[binary body 3 bytes]");

      const sseRes = new Response("event: ping\\ndata: hello\\n\\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });

      const sse = await readResponse({
        requestId: "req-sse",
        res: sseRes,
        started: Date.now() - 3
      });

      expect(sse.eventStream).toBe(true);

      const logEntry: LogEntry = {
        id: "log-1",
        requestId: "req-sse",
        ts: Date.now(),
        pageOrigin: "https://app.example.com",
        url: "https://api.example.com/stream",
        method: "GET",
        requestHeaders: {},
        requestBodyPreview: ""
      };
      applyResponseToLog(logEntry, sse);
      expect(logEntry.status).toBe(200);
      expect(logEntry.responseBodyPreview).toContain("event: ping");
    });
  });

  describe("cache + in-flight state", () => {
    beforeEach(() => {
      clearCache();
    });

    it("expires cached responses by ttl", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));

      setCachedResponse(
        "k1",
        {
          requestId: "req-cache",
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          bodyText: "{\"ok\":true}",
          elapsedMs: 5
        },
        1_000
      );

      expect(getCachedResponse("k1")?.status).toBe(200);
      vi.advanceTimersByTime(1_001);
      expect(getCachedResponse("k1")).toBeNull();
    });

    it("tracks and clears in-flight abort state", () => {
      const controller = new AbortController();
      trackInFlight("req-state", controller);
      abortFetch("req-state");

      expect(controller.signal.aborted).toBe(true);
      expect(wasAbortedByPage("req-state")).toBe(true);

      clearInFlight("req-state");
      expect(wasAbortedByPage("req-state")).toBe(false);

      // Even unknown IDs can be marked as aborted and then cleared safely.
      abortFetch("req-state-unknown");
      expect(wasAbortedByPage("req-state-unknown")).toBe(true);
      clearInFlight("req-state-unknown");
      expect(wasAbortedByPage("req-state-unknown")).toBe(false);
    });
  });
});
