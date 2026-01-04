import type { FetchEnvelope, PageFetchRequest } from "../shared/types";
import { BRIDGE_SOURCE, BRIDGE_TIMEOUT_MS } from "../shared/constants";
import { isTextualResponse } from "../shared/content-type";
import { PAGE_MSG } from "../shared/messages";
import { makeId } from "../shared/ids";
import { createAbortError } from "./errors";
import type { BridgeInit } from "./types";
import type { LiteRequest } from "./types";
import type { Dict } from "../shared/types";

const BRIDGE_DISABLED_MESSAGE =
  "Bridge is disabled for this domain. Enable it in the extension or add <meta name=\"franzai-bridge\" content=\"enabled\"> to your page.";

function getHeaderValue(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

function getRequestHeader(headers: HeadersInit | Dict<string> | [string, string][] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  if (headers instanceof Headers) {
    return headers.get(name) ?? headers.get(target) ?? undefined;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      if (key.toLowerCase() === target) return value;
    }
    return undefined;
  }
  for (const [key, value] of Object.entries(headers as Record<string, string>)) {
    if (key.toLowerCase() === target) return String(value);
  }
  return undefined;
}

type BridgeFetchDeps = {
  ensureDomainEnabled: () => Promise<boolean>;
  requestToLite: (input: RequestInfo | URL, init?: BridgeInit) => Promise<LiteRequest>;
};

export function createBridgeFetch(deps: BridgeFetchDeps) {
  return async (input: RequestInfo | URL, init?: BridgeInit): Promise<Response> => {
    if (!(await deps.ensureDomainEnabled())) {
      throw new Error(BRIDGE_DISABLED_MESSAGE);
    }

    const lite = await deps.requestToLite(input, init);

    if (lite.signal?.aborted) {
      throw createAbortError("The operation was aborted");
    }

    const requestId = makeId("req");
    const req: PageFetchRequest = lite.init
      ? { requestId, url: lite.url, init: lite.init }
      : { requestId, url: lite.url };

    const timeoutMs = typeof init?.franzai?.timeout === "number" && init.franzai.timeout > 0
      ? init.franzai.timeout
      : BRIDGE_TIMEOUT_MS;

    const wantsStream = shouldStream(init, lite);
    if (wantsStream) {
      return streamBridgeFetch(req, lite, timeoutMs);
    }

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
        window.postMessage({
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.FETCH_ABORT,
          payload: { requestId }
        }, "*");
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
          error: `Timed out waiting for FranzAI Bridge response after ${timeoutMs}ms. ` +
            "Check that the extension is installed, enabled, and that this origin is allowed."
        });
      }, timeoutMs);

      window.addEventListener("message", onMessage);
      if (lite.signal) lite.signal.addEventListener("abort", onAbort, { once: true });

      window.postMessage({
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.FETCH_REQUEST,
        payload: req
      }, "*");
    });

    if (!resp.ok || !resp.response) {
      const msg = resp.error ?? resp.response?.error ?? "Unknown error";
      throw new Error(`FranzAI Bridge fetch failed: ${msg}`);
    }

    const r = resp.response;
    const contentType = getHeaderValue(r.headers, "content-type");
    const useText = isTextualResponse(contentType);

    if (!useText && r.bodyBytes) {
      return new Response(r.bodyBytes as BodyInit, {
        status: r.status,
        statusText: r.statusText,
        headers: r.headers
      });
    }

    if (!useText && !r.bodyBytes) {
      console.warn("[FranzAI Bridge] Binary response missing body bytes; falling back to text.");
    }

    return new Response(r.bodyText, {
      status: r.status,
      statusText: r.statusText,
      headers: r.headers
    });
  };
}

function shouldStream(init: BridgeInit | undefined, lite: LiteRequest): boolean {
  if (init?.franzai?.stream) return true;
  const accept = getRequestHeader(lite.init?.headers, "accept");
  return Boolean(accept && accept.includes("text/event-stream"));
}

async function streamBridgeFetch(req: PageFetchRequest, lite: LiteRequest, timeoutMs: number): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    let done = false;
    let responseResolved = false;
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
      cancel() {
        window.postMessage({
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.STREAM_ABORT,
          payload: { requestId: req.requestId }
        }, "*");
      }
    });

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (lite.signal) lite.signal.removeEventListener("abort", onAbort);
      clearTimeout(timeoutId);
    };

    const finishReject = (error: unknown) => {
      if (done) return;
      done = true;
      cleanup();
      reject(error);
    };

    const finishResolve = (response: Response) => {
      if (done) return;
      responseResolved = true;
      resolve(response);
    };

    const onAbort = () => {
      window.postMessage({
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.STREAM_ABORT,
        payload: { requestId: req.requestId }
      }, "*");
      streamController?.error(createAbortError("The operation was aborted"));
      finishReject(createAbortError("The operation was aborted"));
    };

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const data = ev.data as { source?: string; type?: string; payload?: unknown };
      if (!data || data.source !== BRIDGE_SOURCE) return;

      if (data.type === PAGE_MSG.STREAM_HEADERS) {
        const payload = data.payload as { requestId: string; status: number; statusText: string; headers: Record<string, string> };
        if (!payload || payload.requestId !== req.requestId) return;
        if (responseResolved) return;
        const response = new Response(stream, {
          status: payload.status,
          statusText: payload.statusText,
          headers: payload.headers
        });
        finishResolve(response);
      }

      if (data.type === PAGE_MSG.STREAM_CHUNK) {
        const payload = data.payload as { requestId: string; chunk: Uint8Array };
        if (!payload || payload.requestId !== req.requestId) return;
        streamController?.enqueue(new Uint8Array(payload.chunk));
      }

      if (data.type === PAGE_MSG.STREAM_END) {
        const payload = data.payload as { requestId: string };
        if (!payload || payload.requestId !== req.requestId) return;
        streamController?.close();
        done = true;
        cleanup();
      }

      if (data.type === PAGE_MSG.STREAM_ERROR) {
        const payload = data.payload as { requestId: string; message: string };
        if (!payload || payload.requestId !== req.requestId) return;
        const error = new Error(payload.message || "Stream error");
        if (!responseResolved) {
          finishReject(error);
        } else {
          streamController?.error(error);
          done = true;
          cleanup();
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (responseResolved) return;
      finishReject(new Error(`Timed out waiting for FranzAI Bridge stream after ${timeoutMs}ms.`));
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    if (lite.signal) lite.signal.addEventListener("abort", onAbort, { once: true });

    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.STREAM_REQUEST,
      payload: req
    }, "*");
  });
}
