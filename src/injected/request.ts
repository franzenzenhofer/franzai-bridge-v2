import type { BridgeInit, LiteRequest } from "./types";
import type { FetchInitLite } from "../shared/types";
import { bodyToPayload, readRequestBody } from "./body";

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return new URL(input, window.location.href).toString();
  if (input instanceof URL) return new URL(input.toString(), window.location.href).toString();
  return new URL(input.url, window.location.href).toString();
}

function headersToLite(headers?: HeadersInit): { [key: string]: string } | [string, string][] | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const entries: [string, string][] = [];
    headers.forEach((value, key) => entries.push([key, value]));
    return entries;
  }
  if (Array.isArray(headers)) return headers;
  return headers as Record<string, string>;
}

export async function requestToLite(input: RequestInfo | URL, init?: BridgeInit): Promise<LiteRequest> {
  const baseSignal = init?.signal;

  if (typeof input === "string" || input instanceof URL) {
    const headers = new Headers(init?.headers);
    const bodyPayload = init?.body != null ? await bodyToPayload(init.body, headers) : undefined;

    const initPayload: FetchInitLite = {};
    if (init?.method !== undefined) initPayload.method = init.method;
    const headersLite = headersToLite(headers);
    if (headersLite) initPayload.headers = headersLite;
    if (bodyPayload !== undefined) initPayload.body = bodyPayload;
    if (init?.franzai !== undefined) initPayload.franzai = init.franzai;
    if (init?.redirect !== undefined) initPayload.redirect = init.redirect;
    if (init?.credentials !== undefined) initPayload.credentials = init.credentials;
    if (init?.cache !== undefined) initPayload.cache = init.cache;
    if (init?.referrer !== undefined) initPayload.referrer = init.referrer;
    if (init?.referrerPolicy !== undefined) initPayload.referrerPolicy = init.referrerPolicy;
    if (init?.integrity !== undefined) initPayload.integrity = init.integrity;
    if (init?.keepalive !== undefined) initPayload.keepalive = init.keepalive;

    const lite: LiteRequest = { url: resolveUrl(input) };
    if (Object.keys(initPayload).length) lite.init = initPayload;
    if (baseSignal) lite.signal = baseSignal;
    return lite;
  }

  const req = input as Request;
  const headers = new Headers(init?.headers ?? req.headers);

  const bodyPayload =
    init?.body != null
      ? await bodyToPayload(init.body, headers)
      : await readRequestBody(req, headers);

  const initPayload: FetchInitLite = {};
  initPayload.method = init?.method ?? req.method;
  const headersLite = headersToLite(headers);
  if (headersLite) initPayload.headers = headersLite;
  if (bodyPayload !== undefined) initPayload.body = bodyPayload;
  if (init?.franzai !== undefined) initPayload.franzai = init.franzai;
  if (init?.redirect !== undefined) initPayload.redirect = init.redirect;
  if (init?.credentials !== undefined) initPayload.credentials = init.credentials;
  if (init?.cache !== undefined) initPayload.cache = init.cache;
  if (init?.referrer !== undefined) initPayload.referrer = init.referrer;
  if (init?.referrerPolicy !== undefined) initPayload.referrerPolicy = init.referrerPolicy;
  if (init?.integrity !== undefined) initPayload.integrity = init.integrity;
  if (init?.keepalive !== undefined) initPayload.keepalive = init.keepalive;

  const lite: LiteRequest = { url: resolveUrl(req.url), init: initPayload };
  const signal = baseSignal ?? req.signal;
  if (signal) lite.signal = signal;
  return lite;
}
