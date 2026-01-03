import type { BridgeInit, LiteRequest } from "./types";
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

    return {
      url: resolveUrl(input),
      init: {
        method: init?.method,
        headers: headersToLite(headers),
        body: bodyPayload,
        franzai: init?.franzai,
        redirect: init?.redirect,
        credentials: init?.credentials,
        cache: init?.cache,
        referrer: init?.referrer,
        referrerPolicy: init?.referrerPolicy,
        integrity: init?.integrity,
        keepalive: init?.keepalive
      },
      signal: baseSignal ?? undefined
    };
  }

  const req = input as Request;
  const headers = new Headers(init?.headers ?? req.headers);

  const bodyPayload =
    init?.body != null
      ? await bodyToPayload(init.body, headers)
      : await readRequestBody(req, headers);

    return {
      url: resolveUrl(req.url),
      init: {
        method: init?.method ?? req.method,
        headers: headersToLite(headers),
        body: bodyPayload,
        franzai: init?.franzai,
        redirect: init?.redirect ?? req.redirect,
        credentials: init?.credentials ?? req.credentials,
        cache: init?.cache ?? req.cache,
        referrer: init?.referrer ?? req.referrer,
      referrerPolicy: init?.referrerPolicy ?? req.referrerPolicy,
      integrity: init?.integrity ?? req.integrity,
      keepalive: init?.keepalive ?? req.keepalive
    },
    signal: baseSignal ?? req.signal
  };
}
