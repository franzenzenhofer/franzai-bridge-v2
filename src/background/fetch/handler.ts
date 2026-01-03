import type { FetchEnvelope, FetchRequestFromPage, FetchResponseToPage } from "../../shared/types";
import { BG_EVT, type BgEvent } from "../../shared/messages";
import { appendLog, getSettings } from "../../shared/storage";
import { FETCH_TIMEOUT_MS } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { finalizeWithError, makeErrorResponse } from "./errors";
import { buildRequestContext } from "./request";
import { applyResponseToLog, readResponse } from "./response";
import { trackInFlight, clearInFlight, wasAbortedByPage } from "./state";

const log = createLogger("fetch");

export async function handleFetch(
  payload: FetchRequestFromPage,
  tabId: number | undefined,
  broadcast: (evt: BgEvent) => void
): Promise<FetchEnvelope> {
  const settings = await getSettings();
  const started = Date.now();

  log.info("FRANZAI_FETCH", { requestId: payload.requestId, tabId, pageOrigin: payload.pageOrigin, url: payload.url });
  const ctxResult = buildRequestContext(payload, settings, tabId);
  if (!ctxResult.ok) {
    log.warn("Blocked fetch", ctxResult.message);
    return finalizeWithError({
      requestId: payload.requestId,
      statusText: ctxResult.statusText,
      message: ctxResult.message,
      started,
      logEntry: ctxResult.logEntry,
      maxLogs: settings.maxLogs,
      broadcast
    });
  }

  const { url, fetchInit, logEntry } = ctxResult.ctx;

  const controller = new AbortController();
  let timedOut = false;
  const timeoutMs = typeof payload.init?.franzai?.timeout === "number" && payload.init.franzai.timeout > 0
    ? payload.init.franzai.timeout
    : FETCH_TIMEOUT_MS;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  trackInFlight(payload.requestId, controller);

  try {
    const res = await fetch(url.toString(), { ...fetchInit, signal: controller.signal });
    const readResult = await readResponse({ requestId: payload.requestId, res, started });
    if (readResult.eventStream) {
      log.warn("SSE stream detected; buffering full response (no progressive streaming yet).");
    }

    applyResponseToLog(logEntry, readResult);

    await appendLog(logEntry, settings.maxLogs);
    broadcast({ type: BG_EVT.LOGS_UPDATED });

    log.info("Fetch completed", { requestId: payload.requestId, url: url.toString(), status: readResult.response.status, elapsedMs: readResult.elapsedMs });
    return { ok: true, response: readResult.response };
  } catch (e) {
    const elapsedMs = Date.now() - started;
    const err = e instanceof Error ? e.message : String(e);
    const isAbort = e instanceof Error && e.name === "AbortError";

    let message = err;
    let statusText = "Network Error";
    if (isAbort && timedOut) {
      statusText = "Timeout";
      message = `Timed out after ${timeoutMs}ms`;
    } else if (isAbort && wasAbortedByPage(payload.requestId)) {
      statusText = "Aborted";
      message = "Aborted by caller";
    }

    logEntry.error = message;
    logEntry.statusText = statusText;
    logEntry.elapsedMs = elapsedMs;

    await appendLog(logEntry, settings.maxLogs);
    broadcast({ type: BG_EVT.LOGS_UPDATED });

    const responseToPage: FetchResponseToPage = {
      requestId: payload.requestId,
      ok: false,
      status: 0,
      statusText,
      headers: {},
      bodyText: "",
      elapsedMs,
      error: message
    };

    log.error("Fetch failed", { requestId: payload.requestId, statusText, message });
    return { ok: false, response: responseToPage, error: message };
  } finally {
    clearTimeout(timeoutId);
    clearInFlight(payload.requestId);
  }
}
