import { PAGE_MSG } from "../../shared/messages";
import { WS_MSG, type WebSocketPortMessage, type WebSocketOpenPayload, type WebSocketSendPayload, type WebSocketClosePayload } from "../../shared/ws-types";
import { BRIDGE_SOURCE, WS_PORT_NAME } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { fetchDomainStatus, getDomainStatusCache, isBridgeEnabled } from "../domain-status";
import { resolveCurrentDomain } from "../domain";

const log = createLogger("content-ws");
let wsPort: chrome.runtime.Port | null = null;

function postWsMessage(type: string, payload: unknown): void {
  window.postMessage({ source: BRIDGE_SOURCE, type, payload }, "*");
}

function ensurePort(): chrome.runtime.Port {
  if (wsPort) return wsPort;
  wsPort = chrome.runtime.connect({ name: WS_PORT_NAME });
  wsPort.onMessage.addListener((msg: WebSocketPortMessage) => {
    if (msg.type === WS_MSG.OPEN) {
      postWsMessage(PAGE_MSG.WS_OPEN, msg.payload);
    }
    if (msg.type === WS_MSG.MESSAGE) {
      postWsMessage(PAGE_MSG.WS_MESSAGE, msg.payload);
    }
    if (msg.type === WS_MSG.ERROR) {
      postWsMessage(PAGE_MSG.WS_ERROR, msg.payload);
    }
    if (msg.type === WS_MSG.CLOSE) {
      postWsMessage(PAGE_MSG.WS_CLOSED, msg.payload);
    }
  });
  wsPort.onDisconnect.addListener(() => {
    wsPort = null;
  });
  return wsPort;
}

export async function handleWebSocketConnect(payload: WebSocketOpenPayload): Promise<void> {
  const domain = resolveCurrentDomain();
  if (!domain) {
    postWsMessage(PAGE_MSG.WS_ERROR, { socketId: payload.socketId, message: "Bridge domain resolution failed for this frame." });
    return;
  }
  const status = getDomainStatusCache() ?? await fetchDomainStatus(domain);
  if (!isBridgeEnabled(status)) {
    postWsMessage(PAGE_MSG.WS_ERROR, { socketId: payload.socketId, message: "Bridge is disabled for this domain." });
    return;
  }

  const port = ensurePort();
  port.postMessage({ type: WS_MSG.OPEN, payload });
}

export function handleWebSocketSend(payload: WebSocketSendPayload): void {
  const port = ensurePort();
  port.postMessage({ type: WS_MSG.SEND, payload });
}

export function handleWebSocketClose(payload: WebSocketClosePayload): void {
  const port = ensurePort();
  port.postMessage({ type: WS_MSG.CLOSE, payload });
}
