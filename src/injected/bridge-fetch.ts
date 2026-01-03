import type { FetchEnvelope, PageFetchRequest } from "../shared/types";
import { BRIDGE_SOURCE, BRIDGE_TIMEOUT_MS } from "../shared/constants";
import { isTextualResponse } from "../shared/content-type";
import { PAGE_MSG } from "../shared/messages";
import { makeId } from "../shared/ids";
import { createAbortError } from "./errors";
import type { BridgeInit } from "./types";
import type { LiteRequest } from "./types";

const BRIDGE_DISABLED_MESSAGE =
  "Bridge is disabled for this domain. Enable it in the extension or add <meta name=\"franzai-bridge\" content=\"enabled\"> to your page.";

function getHeaderValue(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
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
          error: `Timed out waiting for FranzAI Bridge response after ${BRIDGE_TIMEOUT_MS}ms. ` +
            "Check that the extension is installed, enabled, and that this origin is allowed."
        });
      }, BRIDGE_TIMEOUT_MS);

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
