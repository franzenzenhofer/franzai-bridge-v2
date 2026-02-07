import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import type { BridgeSettings, FetchRequestFromPage } from "../src/shared/types";
import { BG_EVT } from "../src/shared/messages";
import { abortFetch, clearInFlight } from "../src/background/fetch/state";
import { clearCache } from "../src/background/fetch/cache";

const storageMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  appendLog: vi.fn(),
  updateLog: vi.fn()
}));

vi.mock("../src/shared/storage", () => ({
  getSettings: storageMocks.getSettings,
  appendLog: storageMocks.appendLog,
  updateLog: storageMocks.updateLog
}));

import { handleFetch } from "../src/background/fetch/handler";

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

function makePayload(overrides: Partial<FetchRequestFromPage> = {}): FetchRequestFromPage {
  return {
    requestId: "req-default",
    pageOrigin: "https://app.example.com",
    url: "https://api.openai.com/v1/chat/completions",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "user", content: "Hi" }] })
    },
    ...overrides
  };
}

describe("handleFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    storageMocks.getSettings.mockReset();
    storageMocks.appendLog.mockReset();
    storageMocks.updateLog.mockReset();
    clearCache();
    clearInFlight("req-abort");
    clearInFlight("req-timeout");
    clearInFlight("req-a");
    clearInFlight("req-b");
    clearInFlight("req-retry");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns blocked response when page origin is missing", async () => {
    storageMocks.getSettings.mockResolvedValue(makeSettings());
    const broadcast = vi.fn();

    const result = await handleFetch(
      makePayload({ requestId: "req-blocked", pageOrigin: "" }),
      7,
      broadcast
    );

    expect(result.ok).toBe(false);
    expect(result.response?.statusText).toBe("Blocked");
    expect(result.response?.error).toContain("no page origin provided");
    expect(storageMocks.appendLog).toHaveBeenCalledTimes(1);
    expect(storageMocks.updateLog).not.toHaveBeenCalled();
    expect(broadcast).toHaveBeenCalledWith({ type: BG_EVT.LOGS_UPDATED });
  });

  it("returns cached GET response with the current requestId", async () => {
    storageMocks.getSettings.mockResolvedValue(
      makeSettings({
        allowedDestinations: ["api.openai.com"],
        env: { OPENAI_API_KEY: "sk-test" }
      })
    );

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const broadcast = vi.fn();

    const first = await handleFetch(
      makePayload({
        requestId: "req-a",
        url: "https://api.openai.com/v1/models",
        init: { method: "GET", franzai: { cache: { key: "openai-models", ttlMs: 10_000 } } }
      }),
      1,
      broadcast
    );

    const second = await handleFetch(
      makePayload({
        requestId: "req-b",
        url: "https://api.openai.com/v1/models",
        init: { method: "GET", franzai: { cache: { key: "openai-models", ttlMs: 10_000 } } }
      }),
      1,
      broadcast
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.response?.requestId).toBe("req-a");
    expect(second.response?.requestId).toBe("req-b");
  });

  it("times out long-running requests", async () => {
    storageMocks.getSettings.mockResolvedValue(makeSettings({ allowedDestinations: ["api.openai.com"] }));

    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }) as unknown as typeof fetch;

    const result = await handleFetch(
      makePayload({
        requestId: "req-timeout",
        init: {
          method: "GET",
          franzai: {
            timeout: 5
          }
        }
      }),
      1,
      vi.fn()
    );

    expect(result.ok).toBe(false);
    expect(result.response?.statusText).toBe("Timeout");
    expect(result.response?.error).toContain("Timed out after 5ms");
    expect(storageMocks.updateLog).toHaveBeenCalledTimes(1);
  });

  it("reports requests aborted by the page", async () => {
    storageMocks.getSettings.mockResolvedValue(makeSettings({ allowedDestinations: ["api.openai.com"] }));

    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }) as unknown as typeof fetch;

    const requestId = "req-abort";
    const pending = handleFetch(
      makePayload({ requestId, init: { method: "GET", franzai: { timeout: 10_000 } } }),
      1,
      vi.fn()
    );

    setTimeout(() => abortFetch(requestId), 0);
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(result.response?.statusText).toBe("Aborted");
    expect(result.response?.error).toBe("Aborted by caller");
  });

  it("retries retryable status codes and eventually succeeds", async () => {
    storageMocks.getSettings.mockResolvedValue(makeSettings({ allowedDestinations: ["api.openai.com"] }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("busy", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "content-type": "text/plain" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" }
        })
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await handleFetch(
      makePayload({
        requestId: "req-retry",
        init: {
          method: "GET",
          franzai: {
            retry: {
              maxAttempts: 2,
              backoffMs: 1,
              retryOn: [503]
            }
          }
        }
      }),
      1,
      vi.fn()
    );

    expect(result.ok).toBe(true);
    expect(result.response?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("publishes receiving stage before final completion", async () => {
    storageMocks.getSettings.mockResolvedValue(makeSettings({ allowedDestinations: ["api.openai.com"] }));

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" }
      })
    ) as unknown as typeof fetch;

    const broadcast = vi.fn();
    const result = await handleFetch(
      makePayload({
        requestId: "req-stage",
        init: { method: "GET" }
      }),
      1,
      broadcast
    );

    expect(result.ok).toBe(true);
    expect(storageMocks.appendLog).toHaveBeenCalledTimes(1);
    expect(storageMocks.updateLog).toHaveBeenCalledTimes(2);

    expect(storageMocks.updateLog.mock.calls[0]?.[1]).toMatchObject({
      status: 200,
      statusText: "Receiving response..."
    });
    expect(storageMocks.updateLog.mock.calls[1]?.[1]).toMatchObject({
      status: 200,
      statusText: "OK"
    });
    expect(broadcast).toHaveBeenCalledTimes(3);
  });
});
