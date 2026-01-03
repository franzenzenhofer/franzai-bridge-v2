import type { BridgeSettings, Dict, FetchRequestFromPage, LogEntry } from "../../shared/types";
import { builtinProviderRules, headersToObject } from "../../shared/providers";
import { applyInjectionRules, isDestinationAllowed } from "../../shared/policy";
import { REQUEST_BODY_PREVIEW_LIMIT } from "../../shared/constants";
import { makeId } from "../../shared/ids";
import { decodeBinaryBody, isBinaryBody } from "./body";
import { previewBody } from "./preview";

export type RequestContext = {
  url: URL;
  method: string;
  requestHeaders: Dict<string>;
  fetchInit: RequestInit;
  logEntry: LogEntry;
};

export type RequestContextResult =
  | { ok: true; ctx: RequestContext }
  | { ok: false; statusText: string; message: string; logEntry: LogEntry };

export function buildRequestContext(
  payload: FetchRequestFromPage,
  settings: BridgeSettings,
  tabId: number | undefined
): RequestContextResult {
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
    return { ok: false, statusText: "Blocked", message: "Blocked: no page origin provided.", logEntry };
  }

  let url: URL;
  try {
    url = new URL(payload.url);
  } catch {
    return { ok: false, statusText: "Bad URL", message: `Invalid URL: ${payload.url}`, logEntry };
  }

  logEntry.url = url.toString();

  if (!isDestinationAllowed(url, settings.allowedDestinations)) {
    return {
      ok: false,
      statusText: "Blocked",
      message: `Blocked: destination not allowed (${url.hostname}).`,
      logEntry
    };
  }

  const allRules = [...builtinProviderRules(), ...settings.injectionRules];
  applyInjectionRules({ url, headers: requestHeaders, env: settings.env, rules: allRules });

  let fetchBody: BodyInit | undefined;
  if (init.body != null) {
    if (isBinaryBody(init.body)) {
      fetchBody = decodeBinaryBody(init.body) as unknown as BodyInit;
    } else {
      fetchBody = init.body as string;
    }
  }

  const fetchInit: RequestInit = {
    method,
    headers: requestHeaders,
    body: fetchBody,
    redirect: init.redirect,
    credentials: init.credentials,
    cache: init.cache,
    referrer: init.referrer,
    referrerPolicy: init.referrerPolicy,
    integrity: init.integrity,
    keepalive: init.keepalive
  };

  return { ok: true, ctx: { url, method, requestHeaders, fetchInit, logEntry } };
}
