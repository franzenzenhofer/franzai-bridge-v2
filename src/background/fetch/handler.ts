import type { FetchEnvelope, FetchRequestFromPage, FetchResponseToPage } from "../../shared/types";
import { BG_EVT, type BgEvent } from "../../shared/messages";
import { appendLog, updateLog, getSettings } from "../../shared/storage";
import { FETCH_TIMEOUT_MS } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { finalizeWithError, makeErrorResponse } from "./errors";
import { buildRequestContext } from "./request";
import { applyResponseToLog, readResponse } from "./response";
import { trackInFlight, clearInFlight, wasAbortedByPage } from "./state";
import { getCachedResponse, setCachedResponse } from "./cache";

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
  const cacheOptions = payload.init?.franzai?.cache;
  const retryOptions = payload.init?.franzai?.retry;

  if (cacheOptions && (fetchInit.method ?? "GET").toUpperCase() === "GET") {
    const cacheKey = cacheOptions.key ?? `GET:${url.toString()}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      logEntry.status = cached.status;
      logEntry.statusText = cached.statusText;
      logEntry.responseHeaders = cached.headers;
      logEntry.responseBodyPreview = cached.bodyBytes
        ? `[binary body ${cached.bodyBytes.length} bytes]`
        : cached.bodyText;
      logEntry.elapsedMs = 0;

      await appendLog(logEntry, settings.maxLogs);
      broadcast({ type: BG_EVT.LOGS_UPDATED });

      // Ensure caller receives its own requestId even when served from cache.
      return { ok: true, response: { ...cached, requestId: payload.requestId } };
    }
  }

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

  // Immediately add pending log entry so sidepanel shows request right away
  logEntry.statusText = "Pending...";
  await appendLog(logEntry, settings.maxLogs);
  broadcast({ type: BG_EVT.LOGS_UPDATED });

  try {
    const res = await fetchWithRetry(url.toString(), fetchInit, controller.signal, retryOptions);
    const readResult = await readResponse({ requestId: payload.requestId, res, started });
    if (readResult.eventStream) {
      log.warn("SSE stream detected; buffering full response (no progressive streaming yet).");
    }

    applyResponseToLog(logEntry, readResult);

    // Update existing log entry with response data
    await updateLog(logEntry.id, logEntry);
    broadcast({ type: BG_EVT.LOGS_UPDATED });

    if (cacheOptions && (fetchInit.method ?? "GET").toUpperCase() === "GET") {
      const cacheKey = cacheOptions.key ?? `GET:${url.toString()}`;
      const ttlMs = typeof cacheOptions.ttlMs === "number" && cacheOptions.ttlMs > 0
        ? cacheOptions.ttlMs
        : 60_000;
      setCachedResponse(cacheKey, readResult.response, ttlMs);
    }

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
      message = `Timed out after ${timeoutMs}ms. Try increasing franzai.timeout or check your network.`;
    } else if (isAbort && wasAbortedByPage(payload.requestId)) {
      statusText = "Aborted";
      message = "Aborted by caller";
    }

    logEntry.error = message;
    logEntry.statusText = statusText;
    logEntry.elapsedMs = elapsedMs;

    // Update existing log entry with error
    await updateLog(logEntry.id, logEntry);
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

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  retry?: { maxAttempts?: number; backoffMs?: number; retryOn?: number[] }
): Promise<Response> {
  const maxAttempts = retry?.maxAttempts && retry.maxAttempts > 1 ? retry.maxAttempts : 1;
  const backoffMs = retry?.backoffMs ?? 500;
  const retryOn = retry?.retryOn ?? [429, 500, 502, 503, 504];
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      const res = await fetch(url, { ...init, signal });
      if (!retry || attempt >= maxAttempts) return res;
      if (!retryOn.includes(res.status)) return res;
    } catch (err) {
      if (!retry || attempt >= maxAttempts) throw err;
    }

    const delay = backoffMs * Math.pow(2, attempt - 1);
    await wait(delay, signal);
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(new Error("Aborted"));
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
