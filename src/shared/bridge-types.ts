export type Dict<T = string> = Record<string, T>;

export type DomainPreference = {
  enabled: boolean;
  source: "user" | "meta";
  lastModified: number;
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
  settingsVersion: number;
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
