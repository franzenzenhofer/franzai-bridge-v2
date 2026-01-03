import type { GooglePublicAuthState } from "../../shared/types";
import { BRIDGE_SOURCE } from "../../shared/constants";
import { PAGE_MSG } from "../../shared/messages";
import { makeId } from "../../shared/ids";
import { getGoogleAuthState, updateGoogleAuthState } from "../google-state";

export async function googleAuth(scopes?: string | string[]): Promise<GooglePublicAuthState> {
  const scopeArray = scopes ? (Array.isArray(scopes) ? scopes : [scopes]) : [];
  const authId = makeId("gauth");

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ authenticated: false, email: null, scopes: [] });
    }, 30000);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const data = ev.data as { source?: string; type?: string; payload?: { authId: string; success: boolean; state?: GooglePublicAuthState } };
      if (!data || data.source !== BRIDGE_SOURCE || data.type !== PAGE_MSG.GOOGLE_AUTH_RESPONSE) return;
      if (data.payload?.authId !== authId) return;

      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      const state = data.payload.state ?? { authenticated: false, email: null, scopes: [] };
      updateGoogleAuthState(state);
      resolve(state);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: BRIDGE_SOURCE, type: PAGE_MSG.GOOGLE_AUTH_REQUEST, payload: { authId, scopes: scopeArray } }, "*");
  });
}

export async function googleLogout(): Promise<void> {
  const logoutId = makeId("glogout");

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve();
    }, 5000);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const data = ev.data as { source?: string; type?: string; payload?: { logoutId: string } };
      if (!data || data.source !== BRIDGE_SOURCE || data.type !== PAGE_MSG.GOOGLE_LOGOUT_RESPONSE) return;
      if (data.payload?.logoutId !== logoutId) return;

      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      updateGoogleAuthState({ authenticated: false, email: null, scopes: [] });
      resolve();
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: BRIDGE_SOURCE, type: PAGE_MSG.GOOGLE_LOGOUT_REQUEST, payload: { logoutId } }, "*");
  });
}

export async function googleHasScopes(scopes: string | string[]): Promise<boolean> {
  const scopeArray = Array.isArray(scopes) ? scopes : [scopes];
  const scopesId = makeId("gscopes");

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(false);
    }, 5000);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const data = ev.data as { source?: string; type?: string; payload?: { scopesId: string; hasScopes: boolean } };
      if (!data || data.source !== BRIDGE_SOURCE || data.type !== PAGE_MSG.GOOGLE_HAS_SCOPES_RESPONSE) return;
      if (data.payload?.scopesId !== scopesId) return;

      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      resolve(data.payload.hasScopes);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: BRIDGE_SOURCE, type: PAGE_MSG.GOOGLE_HAS_SCOPES_REQUEST, payload: { scopesId, scopes: scopeArray } }, "*");
  });
}

export async function googleGetState(): Promise<GooglePublicAuthState> {
  const stateId = makeId("gstate");

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(getGoogleAuthState());
    }, 5000);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const data = ev.data as { source?: string; type?: string; payload?: { stateId: string; state: GooglePublicAuthState } };
      if (!data || data.source !== BRIDGE_SOURCE || data.type !== PAGE_MSG.GOOGLE_STATE_RESPONSE) return;
      if (data.payload?.stateId !== stateId) return;

      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      updateGoogleAuthState(data.payload.state);
      resolve(data.payload.state);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: BRIDGE_SOURCE, type: PAGE_MSG.GOOGLE_STATE_REQUEST, payload: { stateId } }, "*");
  });
}
