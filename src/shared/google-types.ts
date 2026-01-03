import type { Dict } from "./bridge-types";
import type { FetchInitLite } from "./fetch-types";

export type GoogleAuthState = {
  authenticated: boolean;
  email: string | null;
  scopes: string[];
  accessToken: string | null;
  tokenExpiresAt: number | null;
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
