import type { GoogleAPI } from "../types";
import { getGoogleAuthState } from "../google-state";
import { googleAuth, googleGetState, googleHasScopes, googleLogout } from "./auth";
import { googleFetch } from "./fetch";

export function createGoogleApi(ensureDomainEnabled: () => Promise<boolean>): GoogleAPI {
  return {
    auth: googleAuth,
    logout: googleLogout,
    fetch: (url, init) => googleFetch(url, init, ensureDomainEnabled),
    hasScopes: googleHasScopes,
    getState: googleGetState,
    get isAuthenticated() {
      return getGoogleAuthState().authenticated;
    },
    get email() {
      return getGoogleAuthState().email;
    },
    get scopes() {
      return [...getGoogleAuthState().scopes];
    }
  };
}
