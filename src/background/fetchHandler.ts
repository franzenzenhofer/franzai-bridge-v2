// Fetch request handler for background script

import type { Dict, FetchEnvelope, FetchRequestFromPage, FetchResponseToPage, InjectionRule, LogEntry } from "../shared/types";
import { BG_EVT, type BgEvent } from "../shared/messages";
import { appendLog, getSettings } from "../shared/storage";
import { matchesAnyPattern, wildcardToRegExp } from "../shared/wildcard";
import { builtinProviderRules, expandTemplate, headersToObject, hasHeader } from "../shared/providers";
import { FETCH_TIMEOUT_MS, REQUEST_BODY_PREVIEW_LIMIT, RESPONSE_BODY_PREVIEW_LIMIT } from "../shared/constants";
import { createLogger } from "../shared/logger";
import { makeId } from "../shared/ids";

const log = createLogger("fetch");

const inFlight = new Map<string, AbortController>();
const abortedByPage = new Set<string>();

export function abortFetch(requestId: string): void {
  abortedByPage.add(requestId);
  const controller = inFlight.get(requestId);
  if (controller) controller.abort();
}

function isDestinationAllowed(url: URL, allowedDestinations: string[]): boolean {
  const full = url.toString();
  const host = url.hostname;

  for (const pat of allowedDestinations) {
    const p = pat.trim();
    if (!p) continue;
    if (p.includes("://")) {
      if (wildcardToRegExp(p).test(full)) return true;
    } else {
      if (wildcardToRegExp(p).test(host)) return true;
    }
  }
  return false;
}

function applyInjectionRules(args: { url: URL; headers: Dict<string>; env: Dict<string>; rules: InjectionRule[] }) {
  const { url, headers, env, rules } = args;

  for (const rule of rules) {
    const hostRe = wildcardToRegExp(rule.hostPattern);
    if (!hostRe.test(url.hostname)) continue;

    if (rule.injectHeaders) {
      for (const [hk, hvTemplate] of Object.entries(rule.injectHeaders)) {
        if (hasHeader(headers, hk)) continue;
        const value = expandTemplate(hvTemplate, env).trim();
        if (value) headers[hk] = value;
      }
    }

    if (rule.injectQuery) {
      for (const [qk, qvTemplate] of Object.entries(rule.injectQuery)) {
        if (url.searchParams.has(qk)) continue;
        const value = expandTemplate(qvTemplate, env).trim();
        if (value) url.searchParams.set(qk, value);
      }
    }
  }
}

function previewBody(body: unknown, max: number): string {
  if (body == null) return "";
  if (body instanceof Uint8Array) return `[binary body ${body.byteLength} bytes]`;
  if (body instanceof ArrayBuffer) return `[binary body ${body.byteLength} bytes]`;
  if (typeof body !== "string") return `[${typeof body} body omitted]`;
  if (body.length <= max) return body;
  return body.slice(0, max) + `\n\n...[truncated, total ${body.length} chars]`;
}

function makeErrorResponse(requestId: string, statusText: string, message: string, elapsedMs: number): FetchResponseToPage {
  return { requestId, ok: false, status: 0, statusText, headers: {}, bodyText: "", elapsedMs, error: message };
}

async function finalizeWithError(args: {
  requestId: string;
  statusText: string;
  message: string;
  started: number;
  logEntry: LogEntry;
  maxLogs: number;
  broadcast: (evt: BgEvent) => void;
}): Promise<FetchEnvelope> {
  const { requestId, statusText, message, started, logEntry, maxLogs, broadcast } = args;
  const elapsedMs = Date.now() - started;
  logEntry.status = 0;
  logEntry.statusText = statusText;
  logEntry.error = message;
  logEntry.elapsedMs = elapsedMs;

  await appendLog(logEntry, maxLogs);
  broadcast({ type: BG_EVT.LOGS_UPDATED });

  return { ok: false, response: makeErrorResponse(requestId, statusText, message, elapsedMs), error: message };
}

export async function handleFetch(
  payload: FetchRequestFromPage,
  tabId: number | undefined,
  broadcast: (evt: BgEvent) => void
): Promise<FetchEnvelope> {
  const settings = await getSettings();
  const started = Date.now();

  log.info("FRANZAI_FETCH", { requestId: payload.requestId, tabId, pageOrigin: payload.pageOrigin, url: payload.url });

  const init = payload.init ?? {};
  const method = (init.method ?? "GET").toUpperCase();
  const requestHeaders = headersToObject(init.headers);

  const logEntry: LogEntry = {
    id: makeId("log"),
    requestId: payload.requestId,
    ts: Date.now(),
    tabId,
    pageOrigin: payload.pageOrigin,
    url: payload.url,
    method,
    requestHeaders,
    requestBodyPreview: previewBody(init.body, REQUEST_BODY_PREVIEW_LIMIT)
  };

  if (!payload.pageOrigin) {
    log.warn("Blocked fetch: no origin provided");
    return finalizeWithError({ requestId: payload.requestId, statusText: "Blocked", message: "Blocked: no page origin provided.", started, logEntry, maxLogs: settings.maxLogs, broadcast });
  }

  let url: URL;
  try {
    url = new URL(payload.url);
  } catch {
    log.warn("Blocked fetch: invalid URL", payload.url);
    return finalizeWithError({ requestId: payload.requestId, statusText: "Bad URL", message: `Invalid URL: ${payload.url}`, started, logEntry, maxLogs: settings.maxLogs, broadcast });
  }

  logEntry.url = url.toString();

  if (!isDestinationAllowed(url, settings.allowedDestinations)) {
    log.warn("Blocked fetch: destination not allowed", url.hostname);
    return finalizeWithError({ requestId: payload.requestId, statusText: "Blocked", message: `Blocked: destination not allowed (${url.hostname}).`, started, logEntry, maxLogs: settings.maxLogs, broadcast });
  }

  const allRules = [...builtinProviderRules(), ...settings.injectionRules];
  applyInjectionRules({ url, headers: requestHeaders, env: settings.env, rules: allRules });

  const fetchInit: RequestInit = {
    method,
    headers: requestHeaders,
    body: init.body as BodyInit | undefined,
    redirect: init.redirect,
    credentials: init.credentials,
    cache: init.cache,
    referrer: init.referrer,
    referrerPolicy: init.referrerPolicy,
    integrity: init.integrity,
    keepalive: init.keepalive
  };

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, FETCH_TIMEOUT_MS);

  inFlight.set(payload.requestId, controller);

  try {
    const res = await fetch(url.toString(), { ...fetchInit, signal: controller.signal });
    const headersObj: Dict<string> = {};
    res.headers.forEach((value, key) => { headersObj[key] = value; });

    const bodyText = await res.text();
    const elapsedMs = Date.now() - started;

    logEntry.status = res.status;
    logEntry.statusText = res.statusText;
    logEntry.responseHeaders = headersObj;
    logEntry.responseBodyPreview = previewBody(bodyText, RESPONSE_BODY_PREVIEW_LIMIT);
    logEntry.elapsedMs = elapsedMs;

    await appendLog(logEntry, settings.maxLogs);
    broadcast({ type: BG_EVT.LOGS_UPDATED });

    const responseToPage: FetchResponseToPage = {
      requestId: payload.requestId,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: headersObj,
      bodyText,
      elapsedMs
    };

    log.info("Fetch completed", { requestId: payload.requestId, url: url.toString(), status: res.status, elapsedMs });
    return { ok: true, response: responseToPage };
  } catch (e) {
    const elapsedMs = Date.now() - started;
    const err = e instanceof Error ? e.message : String(e);
    const isAbort = e instanceof Error && e.name === "AbortError";

    let message = err;
    let statusText = "Network Error";
    if (isAbort && timedOut) {
      statusText = "Timeout";
      message = `Timed out after ${FETCH_TIMEOUT_MS}ms`;
    } else if (isAbort && abortedByPage.has(payload.requestId)) {
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
    inFlight.delete(payload.requestId);
    abortedByPage.delete(payload.requestId);
  }
}
