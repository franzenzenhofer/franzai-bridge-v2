// Google OAuth authentication module for FranzAI Bridge
// Uses chrome.identity for secure OAuth flow

import type { BinaryBody, GoogleAuthState, GooglePublicAuthState, Dict, FetchInitLite } from "./types";
import { isTextualResponse } from "./content-type";
import { normalizeScopeInput, scopesInclude } from "./googleScopes";

const STORAGE_KEY = "google_auth";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

// ============ State Helpers ============

function emptyState(): GoogleAuthState {
  return { authenticated: false, email: null, scopes: [], accessToken: null, tokenExpiresAt: null };
}

export function getPublicAuthState(state: GoogleAuthState): GooglePublicAuthState {
  return { authenticated: state.authenticated, email: state.email, scopes: state.scopes };
}

// ============ Storage ============

export const storage = {
  async get(): Promise<GoogleAuthState> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] ?? emptyState();
  },
  async set(state: GoogleAuthState): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  },
  async clear(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  }
};

// ============ Token Management ============

function isExpiringSoon(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  return Date.now() > expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

function requestToken(scopes: string[], interactive: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive, scopes }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error("[FranzAI] Token request failed:", chrome.runtime.lastError?.message);
        resolve(null);
        return;
      }
      resolve(token);
    });
  });
}

async function fetchUserEmail(token: string): Promise<string | null> {
  const resp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.email ?? null;
}

// ============ Public API ============

export async function authenticateGoogle(requestedScopes?: string[]): Promise<GoogleAuthState> {
  const scopes = normalizeScopeInput(requestedScopes);
  const current = await storage.get();

  if (current.authenticated && scopesInclude(current.scopes, scopes)) {
    return current;
  }

  const allScopes = [...new Set([...current.scopes, ...scopes])];
  const token = await requestToken(allScopes, true);
  if (!token) return emptyState();

  const email = await fetchUserEmail(token);
  const newState: GoogleAuthState = {
    authenticated: true,
    email,
    scopes: allScopes,
    accessToken: token,
    tokenExpiresAt: Date.now() + TOKEN_LIFETIME_MS
  };

  await storage.set(newState);
  return newState;
}

export async function logoutGoogle(): Promise<void> {
  const state = await storage.get();
  if (state.accessToken) {
    await removeCachedToken(state.accessToken);
  }
  await storage.clear();
}

export async function getValidAccessToken(): Promise<string | null> {
  const state = await storage.get();
  if (!state.authenticated || !state.accessToken) return null;

  if (!isExpiringSoon(state.tokenExpiresAt)) {
    return state.accessToken;
  }

  // Refresh token
  await removeCachedToken(state.accessToken);
  const newToken = await requestToken(state.scopes, false);
  if (!newToken) {
    await storage.clear();
    return null;
  }

  const refreshed: GoogleAuthState = {
    ...state,
    accessToken: newToken,
    tokenExpiresAt: Date.now() + TOKEN_LIFETIME_MS
  };
  await storage.set(refreshed);
  return newToken;
}

export async function hasGoogleScopes(requiredScopes: string[]): Promise<boolean> {
  const state = await storage.get();
  if (!state.authenticated) return false;
  return scopesInclude(state.scopes, normalizeScopeInput(requiredScopes));
}

export async function googleFetch(
  url: string,
  init?: FetchInitLite
): Promise<{ ok: boolean; status: number; statusText: string; headers: Dict<string>; bodyText: string; bodyBytes?: Uint8Array; error?: string }> {
  const token = await getValidAccessToken();
  if (!token) {
    return { ok: false, status: 401, statusText: "Unauthorized", headers: {}, bodyText: "", error: "Not authenticated" };
  }

  // Convert FetchInitLite headers to HeadersInit
  let headersInit: HeadersInit | undefined;
  if (init?.headers) {
    if (Array.isArray(init.headers)) {
      headersInit = init.headers;
    } else {
      headersInit = init.headers as Record<string, string>;
    }
  }

  const headers = new Headers(headersInit);
  headers.set("Authorization", `Bearer ${token}`);

  // Convert body - handle BinaryBody (base64 encoded) or string
  let body: BodyInit | undefined;
  if (init?.body) {
    const b = init.body as string | BinaryBody;
    if (typeof b === "object" && "__binary" in b && b.__binary === true) {
      // Decode base64 to Uint8Array
      const binary = atob(b.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      body = bytes;
    } else {
      body = b as string;
    }
  }

  try {
    const requestInit: RequestInit = { headers };
    if (init?.method !== undefined) requestInit.method = init.method;
    if (body !== undefined) requestInit.body = body;
    if (init?.redirect !== undefined) requestInit.redirect = init.redirect;
    if (init?.credentials !== undefined) requestInit.credentials = init.credentials;
    if (init?.cache !== undefined) requestInit.cache = init.cache;
    if (init?.referrer !== undefined) requestInit.referrer = init.referrer;
    if (init?.referrerPolicy !== undefined) requestInit.referrerPolicy = init.referrerPolicy;
    if (init?.integrity !== undefined) requestInit.integrity = init.integrity;
    if (init?.keepalive !== undefined) requestInit.keepalive = init.keepalive;

    const response = await fetch(url, requestInit);
    const contentType = response.headers.get("content-type");
    let bodyText = "";
    let bodyBytes: Uint8Array | undefined;
    if (isTextualResponse(contentType)) {
      bodyText = await response.text();
    } else {
      bodyBytes = new Uint8Array(await response.arrayBuffer());
    }
    const responseHeaders: Dict<string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });
    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      bodyText
    };
    if (bodyBytes) {
      return { ...result, bodyBytes };
    }
    return result;
  } catch (err) {
    return { ok: false, status: 0, statusText: "Network Error", headers: {}, bodyText: "", error: String(err) };
  }
}
