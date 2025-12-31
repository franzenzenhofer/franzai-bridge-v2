import type { FetchEnvelope, FetchRequestFromPage, FetchResponseToPage, PageFetchRequest } from "./shared/types";
import { BRIDGE_SOURCE, BRIDGE_TIMEOUT_MS } from "./shared/constants";
import { BG_MSG, PAGE_MSG, type PageToContentMessage } from "./shared/messages";
import { createLogger } from "./shared/logger";
import { sendRuntimeMessage } from "./shared/runtime";

const log = createLogger("content");

let injected = false;

function injectPageScript() {
  if (injected) return;
  injected = true;

  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("injected.js");
    script.async = false;
    (document.documentElement || document.head || document.body).appendChild(script);
    script.onload = () => script.remove();
  } catch (e) {
    log.error("Failed to inject page script", e);
  }
}

injectPageScript();

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;

  const data = event.data as PageToContentMessage | undefined;
  if (!data || data.source !== BRIDGE_SOURCE) return;

  if (data.type === PAGE_MSG.BRIDGE_READY) {
    log.info("Bridge ready", data.payload?.version);
    return;
  }

  if (data.type === PAGE_MSG.FETCH_ABORT) {
    const requestId = data.payload?.requestId;
    if (!requestId) return;

    try {
      await sendRuntimeMessage({
        type: BG_MSG.FETCH_ABORT,
        payload: { requestId }
      });
    } catch (e) {
      log.warn("Failed to forward abort", e);
    }

    return;
  }

  if (data.type === PAGE_MSG.FETCH_REQUEST) {
    const req = data.payload as PageFetchRequest;
    if (!req?.requestId) {
      log.warn("Dropping request without requestId");
      return;
    }

    const payload: FetchRequestFromPage = {
      ...req,
      pageOrigin: window.location.origin
    };

    try {
      const resp = await sendRuntimeMessage<
        { type: typeof BG_MSG.FETCH; payload: FetchRequestFromPage },
        FetchEnvelope
      >({
        type: BG_MSG.FETCH,
        payload
      }, {
        timeoutMs: BRIDGE_TIMEOUT_MS + 5000
      });

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.FETCH_RESPONSE,
          payload: resp
        },
        "*"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorResponse: FetchResponseToPage = {
        requestId: req.requestId,
        ok: false,
        status: 0,
        statusText: "Bridge Error",
        headers: {},
        bodyText: "",
        elapsedMs: 0,
        error: message
      };

      log.error("Bridge error reaching background", message);

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.FETCH_RESPONSE,
          payload: {
            ok: false,
            response: errorResponse,
            error: `Failed to reach FranzAI Bridge background: ${message}`
          }
        },
        "*"
      );
    }
  }
});
