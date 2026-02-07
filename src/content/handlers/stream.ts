import type { PageFetchRequest } from "../../shared/types";
import { PAGE_MSG } from "../../shared/messages";
import { STREAM_MSG, type StreamPortMessage, type StreamStartPayload } from "../../shared/stream-types";
import { BRIDGE_SOURCE, STREAM_PORT_NAME } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { fetchDomainStatus, getDomainStatusCache, isBridgeEnabled } from "../domain-status";
import { resolveCurrentDomain, resolveCurrentOrigin } from "../domain";

const log = createLogger("content-stream");
const BRIDGE_DISABLED_MESSAGE =
  "Bridge is disabled for this domain. Enable it in the extension or add <meta name=\"franzai-bridge\" content=\"enabled\"> to your page.";

type StreamPortEntry = {
  port: chrome.runtime.Port;
  closed: boolean;
};

const streamPorts = new Map<string, StreamPortEntry>();

function postStreamMessage(type: string, payload: unknown): void {
  window.postMessage({
    source: BRIDGE_SOURCE,
    type,
    payload
  }, "*");
}

export async function handleStreamRequest(req: PageFetchRequest): Promise<void> {
  if (!req?.requestId) {
    log.warn("Dropping stream request without requestId");
    return;
  }

  const domain = resolveCurrentDomain();
  if (!domain) {
    postStreamMessage(PAGE_MSG.STREAM_ERROR, { requestId: req.requestId, message: "Bridge domain resolution failed for this frame." });
    return;
  }
  const status = getDomainStatusCache() ?? await fetchDomainStatus(domain);
  if (!isBridgeEnabled(status)) {
    postStreamMessage(PAGE_MSG.STREAM_ERROR, { requestId: req.requestId, message: BRIDGE_DISABLED_MESSAGE });
    return;
  }

  const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });
  const entry: StreamPortEntry = { port, closed: false };
  streamPorts.set(req.requestId, entry);

  const payload: StreamStartPayload = req.init
    ? {
        requestId: req.requestId,
        url: req.url,
        init: req.init,
        pageOrigin: resolveCurrentOrigin() || window.location.origin
      }
    : {
        requestId: req.requestId,
        url: req.url,
        pageOrigin: resolveCurrentOrigin() || window.location.origin
      };

  port.onMessage.addListener((msg: StreamPortMessage) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === STREAM_MSG.HEADERS) {
      postStreamMessage(PAGE_MSG.STREAM_HEADERS, msg.payload);
    }
    if (msg.type === STREAM_MSG.CHUNK) {
      postStreamMessage(PAGE_MSG.STREAM_CHUNK, msg.payload);
    }
    if (msg.type === STREAM_MSG.END) {
      postStreamMessage(PAGE_MSG.STREAM_END, msg.payload);
      cleanupStream(req.requestId);
    }
    if (msg.type === STREAM_MSG.ERROR) {
      postStreamMessage(PAGE_MSG.STREAM_ERROR, msg.payload);
      cleanupStream(req.requestId);
    }
  });

  port.onDisconnect.addListener(() => {
    if (entry.closed) return;
    entry.closed = true;
    if (streamPorts.has(req.requestId)) {
      postStreamMessage(PAGE_MSG.STREAM_ERROR, { requestId: req.requestId, message: "Stream disconnected." });
      cleanupStream(req.requestId);
    }
  });

  port.postMessage({ type: STREAM_MSG.START, payload });
}

export async function handleStreamAbort(requestId: string): Promise<void> {
  const entry = streamPorts.get(requestId);
  if (!entry) return;
  try {
    entry.port.postMessage({ type: STREAM_MSG.ABORT, payload: { requestId } });
  } catch (e) {
    log.warn("Failed to abort stream", e);
  } finally {
    cleanupStream(requestId);
  }
}

function cleanupStream(requestId: string): void {
  const entry = streamPorts.get(requestId);
  if (!entry) return;
  entry.closed = true;
  try {
    entry.port.disconnect();
  } catch {
    // ignore
  }
  streamPorts.delete(requestId);
}
