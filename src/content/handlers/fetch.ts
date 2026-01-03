import type { FetchEnvelope, FetchRequestFromPage, FetchResponseToPage, PageFetchRequest } from "../../shared/types";
import { BG_MSG, PAGE_MSG } from "../../shared/messages";
import { BRIDGE_SOURCE, BRIDGE_TIMEOUT_MS } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { sendRuntimeMessage } from "../../shared/runtime";
import { fetchDomainStatus, getDomainStatusCache, isBridgeEnabled } from "../domain-status";

const log = createLogger("content-fetch");
const BRIDGE_DISABLED_MESSAGE =
  "Bridge is disabled for this domain. Enable it in the extension or add <meta name=\"franzai-bridge\" content=\"enabled\"> to your page.";

function postFetchResponse(payload: FetchEnvelope) {
  window.postMessage({
    source: BRIDGE_SOURCE,
    type: PAGE_MSG.FETCH_RESPONSE,
    payload
  }, "*");
}

function sendBlockedFetchResponse(requestId: string, message: string) {
  const errorResponse: FetchResponseToPage = {
    requestId,
    ok: false,
    status: 0,
    statusText: "Bridge Disabled",
    headers: {},
    bodyText: "",
    elapsedMs: 0,
    error: message
  };

  postFetchResponse({ ok: false, response: errorResponse, error: message });
}

export async function handleFetchAbort(requestId: string): Promise<void> {
  try {
    await sendRuntimeMessage({
      type: BG_MSG.FETCH_ABORT,
      payload: { requestId }
    });
  } catch (e) {
    log.warn("Failed to forward abort", e);
  }
}

export async function handleFetchRequest(req: PageFetchRequest): Promise<void> {
  if (!req?.requestId) {
    log.warn("Dropping request without requestId");
    return;
  }

  const domain = window.location.hostname;
  const status = getDomainStatusCache() ?? await fetchDomainStatus(domain);
  if (!isBridgeEnabled(status)) {
    log.info("Blocked fetch: bridge disabled for domain", domain);
    sendBlockedFetchResponse(req.requestId, BRIDGE_DISABLED_MESSAGE);
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

    postFetchResponse(resp);
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
    postFetchResponse({
      ok: false,
      response: errorResponse,
      error: `Failed to reach FranzAI Bridge background: ${message}`
    });
  }
}
