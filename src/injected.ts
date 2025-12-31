import type { FetchEnvelope, FetchInitLite, PageFetchRequest } from "./shared/types";
import {
  BRIDGE_SOURCE,
  BRIDGE_TIMEOUT_MS,
  BRIDGE_VERSION,
  MAX_BODY_BYTES
} from "./shared/constants";
import { PAGE_MSG } from "./shared/messages";
import { createLogger } from "./shared/logger";
import { makeId } from "./shared/ids";

const log = createLogger("page");

type BridgeMode = "auto" | "always" | "off";

type BridgeConfig = {
  mode: BridgeMode;
};

type BridgeInit = RequestInit & {
  franzai?: {
    mode?: BridgeMode;
  };
};

type LiteRequest = {
  url: string;
  init?: FetchInitLite;
  signal?: AbortSignal;
};

type FranzAIBridge = {
  version: string;
  fetch(input: RequestInfo | URL, init?: BridgeInit): Promise<Response>;
  ping(): Promise<{ ok: true; version: string }>;
  setMode(mode: BridgeMode): BridgeMode;
  getMode(): BridgeMode;
};

const REQUEST_META = Symbol.for("franzaiBridgeMeta");
const textEncoder = new TextEncoder();

function normalizeMode(mode: unknown): BridgeMode | undefined {
  if (mode === "auto" || mode === "always" || mode === "off") return mode;
  return undefined;
}

function getBridgeConfig(): BridgeConfig {
  const w = window as unknown as { __franzaiBridgeConfig?: Partial<BridgeConfig> };
  const existing = w.__franzaiBridgeConfig;
  const config = existing && typeof existing === "object" ? existing : {};
  // Default: "always" - capture ALL requests (including same-origin) for the inspector
  // Users can set "auto" (cross-origin only) or "off" if they want
  const normalized = normalizeMode(config.mode) ?? "always";

  config.mode = normalized;
  w.__franzaiBridgeConfig = config;
  return config as BridgeConfig;
}

const bridgeConfig = getBridgeConfig();

function setRequestMode(request: Request, mode?: BridgeMode) {
  if (!mode) return;
  try {
    Object.defineProperty(request, REQUEST_META, {
      value: mode,
      enumerable: false
    });
  } catch {
    // Ignore metadata errors; fallback to global mode.
  }
}

function getRequestMode(request: Request): BridgeMode | undefined {
  const meta = request as unknown as { [REQUEST_META]?: BridgeMode };
  return normalizeMode(meta[REQUEST_META]);
}

function createAbortError(message: string) {
  try {
    return new DOMException(message, "AbortError");
  } catch {
    const err = new Error(message) as Error & { name?: string };
    err.name = "AbortError";
    return err;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return new URL(input, window.location.href).toString();
  if (input instanceof URL) return new URL(input.toString(), window.location.href).toString();
  return new URL(input.url, window.location.href).toString();
}

function headersToLite(headers?: HeadersInit): FetchInitLite["headers"] {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const entries: [string, string][] = [];
    headers.forEach((value, key) => entries.push([key, value]));
    return entries;
  }
  if (Array.isArray(headers)) return headers;
  return headers as Record<string, string>;
}

function modeFromInit(init?: BridgeInit): BridgeMode | undefined {
  return normalizeMode(init?.franzai?.mode);
}

function resolveBridgeMode(input: RequestInfo | URL, init?: BridgeInit): BridgeMode {
  const initMode = modeFromInit(init);
  if (initMode) return initMode;

  if (input instanceof Request) {
    const requestMode = getRequestMode(input);
    if (requestMode) return requestMode;
  }

  return bridgeConfig.mode ?? "always";
}

function enforceMaxBytes(bytes: number) {
  if (bytes > MAX_BODY_BYTES) {
    throw new Error(`Request body too large (${bytes} bytes). Max is ${MAX_BODY_BYTES} bytes.`);
  }
}

function byteLengthOfString(text: string): number {
  return textEncoder.encode(text).byteLength;
}

function isTextualContentType(contentType?: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith("text/") ||
    ct.includes("json") ||
    ct.includes("xml") ||
    ct.includes("x-www-form-urlencoded")
  );
}

function maybeSetContentType(headers: Headers, value: string | null | undefined) {
  if (!value) return;
  if (!headers.has("content-type")) headers.set("content-type", value);
}

function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer);
  enforceMaxBytes(bytes.byteLength);
  return bytes;
}

async function bodyToPayload(body: BodyInit, headers: Headers): Promise<string | Uint8Array> {
  if (typeof body === "string") {
    enforceMaxBytes(byteLengthOfString(body));
    return body;
  }

  if (body instanceof URLSearchParams) {
    const text = body.toString();
    maybeSetContentType(headers, "application/x-www-form-urlencoded;charset=UTF-8");
    enforceMaxBytes(byteLengthOfString(text));
    return text;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const response = new Response(body);
    maybeSetContentType(headers, response.headers.get("content-type"));
    return toUint8Array(await response.arrayBuffer());
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    if (isTextualContentType(body.type)) {
      const text = await body.text();
      maybeSetContentType(headers, body.type);
      enforceMaxBytes(byteLengthOfString(text));
      return text;
    }

    maybeSetContentType(headers, body.type);
    return toUint8Array(await body.arrayBuffer());
  }

  if (body instanceof ArrayBuffer) {
    return toUint8Array(body);
  }

  if (ArrayBuffer.isView(body)) {
    const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    enforceMaxBytes(bytes.byteLength);
    return bytes;
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    const response = new Response(body);
    return toUint8Array(await response.arrayBuffer());
  }

  throw new Error("FranzAI Bridge cannot forward this body type");
}

async function readRequestBody(
  request: Request,
  headers: Headers
): Promise<string | Uint8Array | undefined> {
  if (!request.body) return undefined;

  const contentType = headers.get("content-type");
  if (isTextualContentType(contentType)) {
    try {
      const text = await request.clone().text();
      enforceMaxBytes(byteLengthOfString(text));
      return text;
    } catch {
      // Fall back to bytes.
    }
  }

  try {
    return toUint8Array(await request.clone().arrayBuffer());
  } catch {
    throw new Error(
      "FranzAI Bridge cannot forward a locked or unreadable request body"
    );
  }
}

async function requestToLite(input: RequestInfo | URL, init?: BridgeInit): Promise<LiteRequest> {
  const baseSignal = init?.signal;

  if (typeof input === "string" || input instanceof URL) {
    const headers = new Headers(init?.headers);
    const bodyPayload = init?.body != null ? await bodyToPayload(init.body, headers) : undefined;

    return {
      url: resolveUrl(input),
      init: {
        method: init?.method,
        headers: headersToLite(headers),
        body: bodyPayload,
        redirect: init?.redirect,
        credentials: init?.credentials,
        cache: init?.cache,
        referrer: init?.referrer,
        referrerPolicy: init?.referrerPolicy,
        integrity: init?.integrity,
        keepalive: init?.keepalive
      },
      signal: baseSignal ?? undefined
    };
  }

  const req = input as Request;
  const headers = new Headers(init?.headers ?? req.headers);

  const bodyPayload =
    init?.body != null
      ? await bodyToPayload(init.body, headers)
      : await readRequestBody(req, headers);

  return {
    url: resolveUrl(req.url),
    init: {
      method: init?.method ?? req.method,
      headers: headersToLite(headers),
      body: bodyPayload,
      redirect: init?.redirect ?? req.redirect,
      credentials: init?.credentials ?? req.credentials,
      cache: init?.cache ?? req.cache,
      referrer: init?.referrer ?? req.referrer,
      referrerPolicy: init?.referrerPolicy ?? req.referrerPolicy,
      integrity: init?.integrity ?? req.integrity,
      keepalive: init?.keepalive ?? req.keepalive
    },
    signal: baseSignal ?? req.signal
  };
}

const nativeFetch: typeof fetch =
  ((window as unknown as { franzaiNativeFetch?: typeof fetch }).franzaiNativeFetch as
    | typeof fetch
    | undefined) ||
  window.fetch.bind(window);

(window as unknown as { franzaiNativeFetch?: typeof fetch }).franzaiNativeFetch = nativeFetch;

const nativeRequest: typeof Request =
  ((window as unknown as { franzaiNativeRequest?: typeof Request }).franzaiNativeRequest as
    | typeof Request
    | undefined) ||
  window.Request;

(window as unknown as { franzaiNativeRequest?: typeof Request }).franzaiNativeRequest =
  nativeRequest;

function isCrossOrigin(input: RequestInfo | URL): boolean {
  try {
    const url = new URL(resolveUrl(input), window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function shouldUseBridgeForRequest(input: RequestInfo | URL, init?: BridgeInit): boolean {
  const mode = resolveBridgeMode(input, init);
  if (mode === "off") return false;
  if (mode === "always") return true;
  return isCrossOrigin(input);
}

const franzai: FranzAIBridge = {
  version: BRIDGE_VERSION,

  async ping() {
    return { ok: true, version: franzai.version };
  },

  setMode(mode: BridgeMode) {
    bridgeConfig.mode = normalizeMode(mode) ?? "auto";
    return bridgeConfig.mode;
  },

  getMode() {
    return bridgeConfig.mode ?? "auto";
  },

  async fetch(input: RequestInfo | URL, init?: BridgeInit): Promise<Response> {
    const lite = await requestToLite(input, init);

    if (lite.signal?.aborted) {
      throw createAbortError("The operation was aborted");
    }

    const requestId = makeId("req");
    const req: PageFetchRequest = { requestId, url: lite.url, init: lite.init };

    const resp = await new Promise<FetchEnvelope>((resolve, reject) => {
      let done = false;

      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        if (lite.signal) lite.signal.removeEventListener("abort", onAbort);
        clearTimeout(timeoutId);
      };

      const finishResolve = (value: FetchEnvelope) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(value);
      };

      const finishReject = (error: unknown) => {
        if (done) return;
        done = true;
        cleanup();
        reject(error);
      };

      const onAbort = () => {
        window.postMessage(
          {
            source: BRIDGE_SOURCE,
            type: PAGE_MSG.FETCH_ABORT,
            payload: { requestId }
          },
          "*"
        );
        finishReject(createAbortError("The operation was aborted"));
      };

      const onMessage = (ev: MessageEvent) => {
        if (ev.source !== window) return;
        const data = ev.data as { source?: string; type?: string; payload?: FetchEnvelope };
        if (!data || data.source !== BRIDGE_SOURCE) return;
        if (data.type !== PAGE_MSG.FETCH_RESPONSE) return;

        const payload = data.payload as FetchEnvelope | undefined;
        const responseObj = payload?.response;
        if (!responseObj || responseObj.requestId !== requestId) return;

        finishResolve(payload);
      };

      const timeoutId = window.setTimeout(() => {
        finishResolve({
          ok: false,
          error: `Timed out waiting for FranzAI Bridge response after ${BRIDGE_TIMEOUT_MS}ms. ` +
            "Check that the extension is installed, enabled, and that this origin is allowed."
        });
      }, BRIDGE_TIMEOUT_MS);

      window.addEventListener("message", onMessage);
      if (lite.signal) lite.signal.addEventListener("abort", onAbort, { once: true });

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.FETCH_REQUEST,
          payload: req
        },
        "*"
      );
    });

    if (!resp.ok || !resp.response) {
      const msg = resp.error ?? resp.response?.error ?? "Unknown error";
      log.warn("Bridge fetch failed", msg);
      throw new Error(`FranzAI Bridge fetch failed: ${msg}`);
    }

    const r = resp.response;
    return new Response(r.bodyText, {
      status: r.status,
      statusText: r.statusText,
      headers: r.headers
    });
  }
};

async function hookedFetch(input: RequestInfo | URL, init?: BridgeInit): Promise<Response> {
  const mode = resolveBridgeMode(input, init);

  if (!shouldUseBridgeForRequest(input, init)) {
    return nativeFetch(input as RequestInfo, init as RequestInit | undefined);
  }

  try {
    return await franzai.fetch(input, init);
  } catch (e) {
    if (isAbortError(e)) throw e;
    if (mode === "always") throw e;

    const msg = e instanceof Error ? e.message : String(e);
    log.debug("Bridge fetch failed, falling back to native fetch", msg);

    try {
      return await nativeFetch(input as RequestInfo, init as RequestInit | undefined);
    } catch {
      throw new Error(msg);
    }
  }
}

function installRequestHook() {
  const w = window as unknown as { __franzaiRequestHookInstalled?: boolean };
  if (w.__franzaiRequestHookInstalled) return;
  w.__franzaiRequestHookInstalled = true;

  const FranzaiRequest = function (
    input: RequestInfo | URL,
    init?: BridgeInit
  ): Request {
    const req = new nativeRequest(input, init as RequestInit | undefined);
    setRequestMode(req, modeFromInit(init));
    return req;
  } as unknown as typeof Request;

  FranzaiRequest.prototype = nativeRequest.prototype;
  Object.setPrototypeOf(FranzaiRequest, nativeRequest);

  try {
    Object.defineProperty(window, "Request", {
      configurable: true,
      writable: true,
      value: FranzaiRequest
    });
  } catch {
    window.Request = FranzaiRequest;
  }
}

(window as unknown as { franzai?: FranzAIBridge }).franzai = franzai;

(() => {
  const w = window as unknown as { __franzaiFetchHookInstalled?: boolean };
  if (w.__franzaiFetchHookInstalled) return;

  w.__franzaiFetchHookInstalled = true;
  installRequestHook();

  try {
    Object.defineProperty(window, "fetch", {
      configurable: true,
      writable: true,
      value: hookedFetch
    });
  } catch {
    window.fetch = hookedFetch as typeof fetch;
  }

  window.postMessage(
    {
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.BRIDGE_READY,
      payload: { version: franzai.version }
    },
    "*"
  );

  log.info("window.fetch + window.Request are routed through FranzAI Bridge");
})();
