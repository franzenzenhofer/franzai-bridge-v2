import type { BridgeStatus, FetchInitLite, GooglePublicAuthState } from "../shared/types";

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

export type BridgeConfig = {
  mode: BridgeMode;
  lockHooks?: boolean;
};

export type BridgeInit = RequestInit & {
  franzai?: BridgeRequestOptions;
};

export type LiteRequest = {
  url: string;
  init?: FetchInitLite;
  signal?: AbortSignal;
};

export type GoogleAPI = {
  auth(scopes?: string | string[]): Promise<GooglePublicAuthState>;
  logout(): Promise<void>;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  hasScopes(scopes: string | string[]): Promise<boolean>;
  getState(): Promise<GooglePublicAuthState>;
  readonly isAuthenticated: boolean;
  readonly email: string | null;
  readonly scopes: string[];
};

export type FranzAIBridge = {
  version: string;
  fetch(input: RequestInfo | URL, init?: BridgeInit): Promise<Response>;
  ping(): Promise<{ ok: true; version: string }>;
  setMode(mode: BridgeMode): BridgeMode;
  getMode(): BridgeMode;
  isKeySet(keyName: string): Promise<boolean>;
  hasApiKey(keyName: string): Promise<boolean>;
  keys: string[];
  getStatus(): Promise<BridgeStatus>;
  google: GoogleAPI;
};
