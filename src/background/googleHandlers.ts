// Google OAuth handlers for background script

import type { GoogleFetchRequest, GoogleFetchResponse, GooglePublicAuthState } from "../shared/types";
import { BG_EVT, type BgEvent } from "../shared/messages";
import {
  authenticateGoogle,
  logoutGoogle,
  storage as googleStorage,
  getPublicAuthState,
  hasGoogleScopes,
  googleFetch
} from "../shared/googleAuth";

export async function handleGoogleAuth(
  scopes: string[],
  broadcast: (evt: BgEvent) => void
): Promise<{ ok: boolean; state: GooglePublicAuthState }> {
  const state = await authenticateGoogle(scopes);
  const publicState = getPublicAuthState(state);
  broadcast({ type: BG_EVT.GOOGLE_AUTH_UPDATED, payload: publicState });
  return { ok: state.authenticated, state: publicState };
}

export async function handleGoogleLogout(
  broadcast: (evt: BgEvent) => void
): Promise<{ ok: boolean }> {
  await logoutGoogle();
  const publicState: GooglePublicAuthState = { authenticated: false, email: null, scopes: [] };
  broadcast({ type: BG_EVT.GOOGLE_AUTH_UPDATED, payload: publicState });
  return { ok: true };
}

export async function handleGoogleGetState(): Promise<{ ok: boolean; state: GooglePublicAuthState }> {
  const state = await googleStorage.get();
  return { ok: true, state: getPublicAuthState(state) };
}

export async function handleGoogleHasScopes(scopes: string[]): Promise<{ ok: boolean; hasScopes: boolean }> {
  const has = await hasGoogleScopes(scopes);
  return { ok: true, hasScopes: has };
}

export async function handleGoogleFetch(
  payload: GoogleFetchRequest
): Promise<GoogleFetchResponse> {
  const result = await googleFetch(payload.url, payload.init);
  return { ...result, requestId: payload.requestId };
}
