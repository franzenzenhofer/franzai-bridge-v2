import { STREAM_MSG, type StreamPortMessage, type StreamStartPayload } from "../shared/stream-types";
import { STREAM_HEADER_TIMEOUT_MS, STREAM_INACTIVITY_TIMEOUT_MS, STREAM_PORT_NAME, RESPONSE_BODY_PREVIEW_LIMIT } from "../shared/constants";
import { createLogger } from "../shared/logger";
import { getSettings, appendLog } from "../shared/storage";
import { buildRequestContext } from "./fetch/request";
import { isEventStream, isTextualResponse } from "../shared/content-type";
import { previewBody } from "./fetch/preview";
import { BG_EVT, type BgEvent } from "../shared/messages";
import type { LogEntry } from "../shared/types";

const log = createLogger("stream");

type StreamSession = {
  port: chrome.runtime.Port;
  controller: AbortController;
  started: number;
  requestId: string;
  logEntry: LogEntry;
};

const sessions = new Map<string, StreamSession>();

export function registerStreamHandlers(broadcast: (evt: BgEvent) => void): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== STREAM_PORT_NAME) return;

    port.onMessage.addListener((msg: StreamPortMessage) => {
      if (msg.type === STREAM_MSG.START) {
        handleStreamStart(msg.payload, port, broadcast);
        return;
      }
      if (msg.type === STREAM_MSG.ABORT) {
        handleStreamAbort(msg.payload.requestId);
      }
    });
  });
}

async function handleStreamStart(payload: StreamStartPayload, port: chrome.runtime.Port, broadcast: (evt: BgEvent) => void): Promise<void> {
  const settings = await getSettings();
  const started = Date.now();
  const tabId = port.sender?.tab?.id;

  const requestPayload = {
    requestId: payload.requestId,
    url: payload.url,
    pageOrigin: payload.pageOrigin
  } as const;
  const ctxResult = buildRequestContext(
    payload.init ? { ...requestPayload, init: payload.init } : requestPayload,
    settings,
    tabId
  );

  if (!ctxResult.ok) {
    ctxResult.logEntry.error = ctxResult.message;
    ctxResult.logEntry.statusText = ctxResult.statusText;
    ctxResult.logEntry.elapsedMs = Date.now() - started;
    await appendLog(ctxResult.logEntry, settings.maxLogs);
    broadcast({ type: BG_EVT.LOGS_UPDATED });

    port.postMessage({ type: STREAM_MSG.ERROR, payload: { requestId: payload.requestId, message: ctxResult.message } });
    return;
  }

  const { url, fetchInit, logEntry } = ctxResult.ctx;
  const controller = new AbortController();
  const session: StreamSession = { port, controller, started, requestId: payload.requestId, logEntry };
  sessions.set(payload.requestId, session);

  let headerTimeout: number | null = null;
  let inactivityTimeout: number | null = null;

  const resetInactivity = (timeoutMs: number) => {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs) as unknown as number;
  };

  headerTimeout = setTimeout(() => {
    controller.abort();
  }, STREAM_HEADER_TIMEOUT_MS) as unknown as number;

  try {
    const res = await fetch(url.toString(), { ...fetchInit, signal: controller.signal });
    if (headerTimeout) clearTimeout(headerTimeout);

    const headersObj: Record<string, string> = {};
    res.headers.forEach((value, key) => { headersObj[key] = value; });

    port.postMessage({
      type: STREAM_MSG.HEADERS,
      payload: {
        requestId: payload.requestId,
        status: res.status,
        statusText: res.statusText,
        headers: headersObj
      }
    });

    const contentType = res.headers.get("content-type");
    const isText = isTextualResponse(contentType);
    const eventStream = isEventStream(contentType);

    if (eventStream) {
      log.warn("SSE stream detected; forwarding chunks to page.");
    }

    const decoder = new TextDecoder();
    let textPreview = "";
    let binaryBytes = 0;

    if (!res.body) {
      const fallbackText = await res.text();
      const encoder = new TextEncoder();
      port.postMessage({ type: STREAM_MSG.CHUNK, payload: { requestId: payload.requestId, chunk: encoder.encode(fallbackText) } });
    } else {
      const reader = res.body.getReader();
      const inactivityMs = typeof payload.init?.franzai?.timeout === "number" && payload.init.franzai.timeout > 0
        ? payload.init.franzai.timeout
        : STREAM_INACTIVITY_TIMEOUT_MS;
      resetInactivity(inactivityMs);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        port.postMessage({ type: STREAM_MSG.CHUNK, payload: { requestId: payload.requestId, chunk: value } });
        resetInactivity(inactivityMs);

        if (isText) {
          textPreview += decoder.decode(value, { stream: true });
          if (textPreview.length > RESPONSE_BODY_PREVIEW_LIMIT) {
            textPreview = textPreview.slice(0, RESPONSE_BODY_PREVIEW_LIMIT);
          }
        } else {
          binaryBytes += value.length;
        }
      }
    }

    port.postMessage({ type: STREAM_MSG.END, payload: { requestId: payload.requestId } });

    logEntry.status = res.status;
    logEntry.statusText = res.statusText;
    logEntry.responseHeaders = headersObj;
    logEntry.elapsedMs = Date.now() - started;
    logEntry.responseBodyPreview = isText
      ? previewBody(textPreview, RESPONSE_BODY_PREVIEW_LIMIT)
      : `[binary stream ${binaryBytes} bytes]`;

    await appendLog(logEntry, settings.maxLogs);
    broadcast({ type: BG_EVT.LOGS_UPDATED });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logEntry.error = message;
    logEntry.statusText = "Stream Error";
    logEntry.elapsedMs = Date.now() - started;
    await appendLog(logEntry, settings.maxLogs);
    broadcast({ type: BG_EVT.LOGS_UPDATED });

    port.postMessage({ type: STREAM_MSG.ERROR, payload: { requestId: payload.requestId, message } });
  } finally {
    if (headerTimeout) clearTimeout(headerTimeout);
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    sessions.delete(payload.requestId);
  }
}

function handleStreamAbort(requestId: string): void {
  const session = sessions.get(requestId);
  if (!session) return;
  session.controller.abort();
  sessions.delete(requestId);
}
