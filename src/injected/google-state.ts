import type { GooglePublicAuthState } from "../shared/types";

let googleAuthState: GooglePublicAuthState = {
  authenticated: false,
  email: null,
  scopes: []
};

export function updateGoogleAuthState(state: GooglePublicAuthState): void {
  googleAuthState = state;
}

export function getGoogleAuthState(): GooglePublicAuthState {
  return googleAuthState;
}
