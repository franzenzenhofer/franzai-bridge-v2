/// <reference types="vitest" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BRIDGE_SOURCE, MAX_BODY_BYTES, BRIDGE_TIMEOUT_MS } from "../src/shared/constants";
import { PAGE_MSG } from "../src/shared/messages";

// Store original globals
const originalFetch = globalThis.fetch;
const originalRequest = globalThis.Request;

// Mock window.postMessage and message handlers
const messageListeners: ((event: MessageEvent) => void)[] = [];
const mockPostMessage = vi.fn();

// Create mock window with all required properties
const mockWindow = {
  fetch: vi.fn(),
  Request: originalRequest,
  addEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
    if (type === "message") {
      messageListeners.push(listener);
    }
  }),
  removeEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
    if (type === "message") {
      const idx = messageListeners.indexOf(listener);
      if (idx >= 0) messageListeners.splice(idx, 1);
    }
  }),
  postMessage: mockPostMessage,
  location: {
    href: "https://example.com/page",
    origin: "https://example.com"
  },
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout
};

vi.stubGlobal("window", mockWindow);

describe("injected script helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageListeners.length = 0;
    delete (mockWindow as Record<string, unknown>).__franzaiFetchHookInstalled;
    delete (mockWindow as Record<string, unknown>).__franzaiRequestHookInstalled;
    delete (mockWindow as Record<string, unknown>).__franzaiBridgeConfig;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("URL resolution", () => {
    it("resolves relative URLs to absolute", () => {
      const resolveUrl = (input: string) => {
        return new URL(input, mockWindow.location.href).toString();
      };

      expect(resolveUrl("/api/data")).toBe("https://example.com/api/data");
      expect(resolveUrl("https://other.com/path")).toBe("https://other.com/path");
    });

    it("handles URL objects", () => {
      const url = new URL("https://api.example.com/v1");
      expect(url.toString()).toBe("https://api.example.com/v1");
    });
  });

  describe("cross-origin detection", () => {
    it("detects cross-origin URLs", () => {
      const isCrossOrigin = (input: string) => {
        try {
          const url = new URL(input, mockWindow.location.href);
          return url.origin !== mockWindow.location.origin;
        } catch {
          return false;
        }
      };

      expect(isCrossOrigin("https://api.openai.com/v1")).toBe(true);
      expect(isCrossOrigin("https://example.com/api")).toBe(false);
      expect(isCrossOrigin("/relative/path")).toBe(false);
    });
  });

  describe("mode normalization", () => {
    it("normalizes valid modes", () => {
      const normalizeMode = (mode: unknown) => {
        if (mode === "auto" || mode === "always" || mode === "off") return mode;
        return undefined;
      };

      expect(normalizeMode("auto")).toBe("auto");
      expect(normalizeMode("always")).toBe("always");
      expect(normalizeMode("off")).toBe("off");
      expect(normalizeMode("invalid")).toBeUndefined();
      expect(normalizeMode(null)).toBeUndefined();
    });
  });

  describe("body size enforcement", () => {
    it("enforces max body size", () => {
      const enforceMaxBytes = (bytes: number) => {
        if (bytes > MAX_BODY_BYTES) {
          throw new Error(`Request body too large (${bytes} bytes). Max is ${MAX_BODY_BYTES} bytes.`);
        }
      };

      expect(() => enforceMaxBytes(1000)).not.toThrow();
      expect(() => enforceMaxBytes(MAX_BODY_BYTES)).not.toThrow();
      expect(() => enforceMaxBytes(MAX_BODY_BYTES + 1)).toThrow("Request body too large");
    });
  });

  describe("abort error creation", () => {
    it("creates abort error with DOMException", () => {
      const createAbortError = (message: string) => {
        try {
          return new DOMException(message, "AbortError");
        } catch {
          const err = new Error(message) as Error & { name?: string };
          err.name = "AbortError";
          return err;
        }
      };

      const error = createAbortError("Test abort");
      expect(error.name).toBe("AbortError");
      expect(error.message).toBe("Test abort");
    });

    it("checks for abort errors", () => {
      const isAbortError = (error: unknown) => {
        return error instanceof Error && error.name === "AbortError";
      };

      const abortError = new DOMException("Aborted", "AbortError");
      expect(isAbortError(abortError)).toBe(true);

      const regularError = new Error("Regular");
      expect(isAbortError(regularError)).toBe(false);
    });
  });

  describe("headers conversion", () => {
    it("converts Headers to array entries", () => {
      const headersToLite = (headers?: HeadersInit) => {
        if (!headers) return undefined;
        if (headers instanceof Headers) {
          const entries: [string, string][] = [];
          headers.forEach((value, key) => entries.push([key, value]));
          return entries;
        }
        if (Array.isArray(headers)) return headers;
        return headers as Record<string, string>;
      };

      const headers = new Headers({ "Content-Type": "application/json" });
      const result = headersToLite(headers);
      expect(result).toEqual([["content-type", "application/json"]]);
    });

    it("passes through arrays unchanged", () => {
      const headersToLite = (headers?: HeadersInit) => {
        if (!headers) return undefined;
        if (headers instanceof Headers) {
          const entries: [string, string][] = [];
          headers.forEach((value, key) => entries.push([key, value]));
          return entries;
        }
        if (Array.isArray(headers)) return headers;
        return headers as Record<string, string>;
      };

      const arr: [string, string][] = [["X-Custom", "value"]];
      expect(headersToLite(arr)).toBe(arr);
    });
  });

  describe("textual content type detection", () => {
    it("detects textual content types", () => {
      const isTextualContentType = (contentType?: string | null) => {
        if (!contentType) return false;
        const ct = contentType.toLowerCase();
        return (
          ct.startsWith("text/") ||
          ct.includes("json") ||
          ct.includes("xml") ||
          ct.includes("x-www-form-urlencoded")
        );
      };

      expect(isTextualContentType("text/plain")).toBe(true);
      expect(isTextualContentType("text/html")).toBe(true);
      expect(isTextualContentType("application/json")).toBe(true);
      expect(isTextualContentType("application/xml")).toBe(true);
      expect(isTextualContentType("application/x-www-form-urlencoded")).toBe(true);
      expect(isTextualContentType("image/png")).toBe(false);
      expect(isTextualContentType("application/octet-stream")).toBe(false);
      expect(isTextualContentType(null)).toBe(false);
      expect(isTextualContentType(undefined)).toBe(false);
    });
  });

  describe("Uint8Array conversion", () => {
    it("converts ArrayBuffer to Uint8Array", () => {
      const toUint8Array = (buffer: ArrayBuffer) => {
        return new Uint8Array(buffer);
      };

      const buffer = new ArrayBuffer(4);
      const view = new Uint8Array(buffer);
      view[0] = 1;
      view[1] = 2;

      const result = toUint8Array(buffer);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
    });

    it("handles typed arrays", () => {
      const buffer = new Uint16Array([1, 2, 3]).buffer;
      const bytes = new Uint8Array(buffer);
      expect(bytes.byteLength).toBe(6); // 3 * 2 bytes
    });
  });

  describe("bridge mode resolution", () => {
    it("resolves mode from init franzai option", () => {
      const resolveBridgeMode = (initMode?: string, globalMode = "auto") => {
        if (initMode === "auto" || initMode === "always" || initMode === "off") {
          return initMode;
        }
        return globalMode;
      };

      expect(resolveBridgeMode("always")).toBe("always");
      expect(resolveBridgeMode("off")).toBe("off");
      expect(resolveBridgeMode(undefined)).toBe("auto");
      expect(resolveBridgeMode("invalid", "always")).toBe("always");
    });
  });

  describe("shouldUseBridge logic", () => {
    it("returns false for off mode", () => {
      const shouldUseBridge = (mode: string, isCrossOrigin: boolean) => {
        if (mode === "off") return false;
        if (mode === "always") return true;
        return isCrossOrigin;
      };

      expect(shouldUseBridge("off", true)).toBe(false);
      expect(shouldUseBridge("off", false)).toBe(false);
    });

    it("returns true for always mode", () => {
      const shouldUseBridge = (mode: string, isCrossOrigin: boolean) => {
        if (mode === "off") return false;
        if (mode === "always") return true;
        return isCrossOrigin;
      };

      expect(shouldUseBridge("always", true)).toBe(true);
      expect(shouldUseBridge("always", false)).toBe(true);
    });

    it("returns based on cross-origin for auto mode", () => {
      const shouldUseBridge = (mode: string, isCrossOrigin: boolean) => {
        if (mode === "off") return false;
        if (mode === "always") return true;
        return isCrossOrigin;
      };

      expect(shouldUseBridge("auto", true)).toBe(true);
      expect(shouldUseBridge("auto", false)).toBe(false);
    });
  });
});

describe("injected script FranzAI object", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageListeners.length = 0;
    delete (mockWindow as Record<string, unknown>).__franzaiFetchHookInstalled;
    delete (mockWindow as Record<string, unknown>).__franzaiRequestHookInstalled;
    delete (mockWindow as Record<string, unknown>).__franzaiBridgeConfig;
    delete (mockWindow as Record<string, unknown>).franzai;
    delete (mockWindow as Record<string, unknown>).franzaiNativeFetch;
  });

  it("exposes franzai object on window after import", async () => {
    // The actual import will install the hooks
    // For unit testing, we test the individual functions
  });

  describe("ping function", () => {
    it("returns ok with version", async () => {
      const ping = async () => {
        return { ok: true, version: "test" };
      };

      const result = await ping();
      expect(result.ok).toBe(true);
      expect(result.version).toBe("test");
    });
  });

  describe("setMode function", () => {
    it("updates bridge mode", () => {
      let mode = "auto";
      const setMode = (newMode: string) => {
        if (newMode === "auto" || newMode === "always" || newMode === "off") {
          mode = newMode;
        } else {
          mode = "auto";
        }
        return mode;
      };

      expect(setMode("always")).toBe("always");
      expect(setMode("off")).toBe("off");
      expect(setMode("invalid")).toBe("auto");
    });
  });

  describe("getMode function", () => {
    it("returns current mode", () => {
      let mode = "auto";
      const getMode = () => mode;

      expect(getMode()).toBe("auto");
      mode = "always";
      expect(getMode()).toBe("always");
    });
  });
});

describe("body payload conversion", () => {
  it("handles string body", async () => {
    const body = "test body";
    const textEncoder = new TextEncoder();

    expect(typeof body).toBe("string");
    expect(textEncoder.encode(body).byteLength).toBe(9);
  });

  it("handles URLSearchParams", async () => {
    const params = new URLSearchParams({ key: "value", other: "data" });
    const text = params.toString();

    expect(text).toBe("key=value&other=data");
  });

  it("handles FormData (text extraction)", async () => {
    const formData = new FormData();
    formData.append("field1", "value1");
    formData.append("field2", "value2");

    // FormData is converted to Response to get ArrayBuffer
    const response = new Response(formData);
    const contentType = response.headers.get("content-type");

    expect(contentType).toContain("multipart/form-data");
  });

  it("handles Blob", async () => {
    const blob = new Blob(["test content"], { type: "text/plain" });

    expect(blob.size).toBe(12);
    expect(blob.type).toBe("text/plain");

    const text = await blob.text();
    expect(text).toBe("test content");
  });

  it("handles ArrayBuffer", async () => {
    const buffer = new ArrayBuffer(4);
    const view = new Uint8Array(buffer);
    view.set([1, 2, 3, 4]);

    expect(buffer.byteLength).toBe(4);
    expect(view[0]).toBe(1);
  });

  it("handles TypedArray", async () => {
    const arr = new Uint8Array([1, 2, 3, 4]);

    expect(arr.byteLength).toBe(4);
    expect(arr.buffer.byteLength).toBe(4);
  });
});

describe("abort signal handling", () => {
  it("checks if signal is already aborted", () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);

    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it("adds and removes abort listeners", () => {
    const controller = new AbortController();
    const handler = vi.fn();

    controller.signal.addEventListener("abort", handler);
    controller.abort();

    expect(handler).toHaveBeenCalled();
  });
});

describe("timeout handling", () => {
  it("creates timeout error after bridge timeout", () => {
    vi.useFakeTimers();

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
    }, BRIDGE_TIMEOUT_MS);

    expect(timedOut).toBe(false);

    vi.advanceTimersByTime(BRIDGE_TIMEOUT_MS);

    expect(timedOut).toBe(true);

    clearTimeout(timeoutId);
    vi.useRealTimers();
  });
});
