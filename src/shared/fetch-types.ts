import type { BridgeRequestOptions, Dict } from "./bridge-types";

// Binary body representation that survives message passing
export type BinaryBody = {
  __binary: true;
  base64: string;
  byteLength: number;
};

export type FetchInitLite = {
  method?: string;
  headers?: Dict<string> | [string, string][];
  body?: string | BinaryBody;
  redirect?: RequestRedirect;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
  keepalive?: boolean;
  franzai?: BridgeRequestOptions;
};

export type PageFetchRequest = {
  requestId: string;
  url: string;
  init?: FetchInitLite;
};

export type FetchRequestFromPage = PageFetchRequest & {
  pageOrigin: string;
};

export type FetchResponseToPage = {
  requestId: string;
  ok: boolean;
  status: number;
  statusText: string;
  headers: Dict<string>;
  bodyText: string;
  bodyBytes?: Uint8Array;
  elapsedMs: number;
  error?: string;
};

export type FetchEnvelope = {
  ok: boolean;
  response?: FetchResponseToPage;
  error?: string;
};
