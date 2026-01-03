export type Dict<T = string> = Record<string, T>;

export type DomainPreference = {
  enabled: boolean;
  source: "user" | "meta";  // Who set this preference
  lastModified: number;     // Timestamp
};

export type DomainPreferences = Dict<DomainPreference>;

export type BridgeStatus = {
  installed: boolean;
  version: string;
  domainEnabled: boolean;
  domainSource: "user" | "meta" | "default";
  originAllowed: boolean;
  hasApiKeys: boolean;
  ready: boolean;
  reason: string;
};

export type InjectionRule = {
  hostPattern: string;
  injectHeaders?: Dict<string>;
  injectQuery?: Dict<string>;
};

export type BridgeSettings = {
  settingsVersion: number;  // Bump this when defaults change - triggers auto-migration
  allowedOrigins: string[];
  allowedDestinations: string[];
  env: Dict<string>;
  injectionRules: InjectionRule[];
  maxLogs: number;
};

export type BridgeMode = "auto" | "always" | "off";

export type BridgeRetryOptions = {
  maxAttempts?: number;
  backoffMs?: number;
  retryOn?: number[];
};

export type BridgeCacheOptions = {
  ttlMs?: number;
  key?: string;
};

export type BridgeRequestOptions = {
  mode?: BridgeMode;
  timeout?: number;
  retry?: BridgeRetryOptions;
  cache?: BridgeCacheOptions;
  stream?: boolean;
};

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

export type LogEntry = {
  id: string;
  requestId: string;
  ts: number;
  tabId?: number;
  pageOrigin: string;
  url: string;
  method: string;
  requestHeaders: Dict<string>;
  requestBodyPreview: string;
  status?: number;
  statusText?: string;
  responseHeaders?: Dict<string>;
  responseBodyPreview?: string;
  elapsedMs?: number;
  error?: string;
};

// Google OAuth types
export type GoogleAuthState = {
  authenticated: boolean;
  email: string | null;
  scopes: string[];
  accessToken: string | null;
  tokenExpiresAt: number | null;  // Unix timestamp (ms)
};

export type GooglePublicAuthState = {
  authenticated: boolean;
  email: string | null;
  scopes: string[];
};

export type GoogleFetchRequest = {
  requestId: string;
  url: string;
  init?: FetchInitLite;
  requiredScopes?: string[];
};

export type GoogleFetchResponse = {
  requestId: string;
  ok: boolean;
  status: number;
  statusText: string;
  headers: Dict<string>;
  bodyText: string;
  bodyBytes?: Uint8Array;
  error?: string;
};
