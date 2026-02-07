import type { GoogleFetchRequest, GoogleFetchResponse, GooglePublicAuthState } from "../../shared/types";
import { BG_MSG, PAGE_MSG } from "../../shared/messages";
import { BRIDGE_SOURCE } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { sendRuntimeMessage } from "../../shared/runtime";
import { fetchDomainStatus, getDomainStatusCache, isBridgeEnabled } from "../domain-status";
import { resolveCurrentDomain } from "../domain";

const log = createLogger("content-google");
const BRIDGE_DISABLED_MESSAGE =
  "Bridge is disabled for this domain. Enable it in the extension or add <meta name=\"franzai-bridge\" content=\"enabled\"> to your page.";

function sendBlockedGoogleFetchResponse(requestId: string, message: string) {
  window.postMessage({
    source: BRIDGE_SOURCE,
    type: PAGE_MSG.GOOGLE_FETCH_RESPONSE,
    payload: {
      requestId,
      ok: false,
      status: 0,
      statusText: "Bridge Disabled",
      headers: {},
      bodyText: "",
      error: message
    }
  }, "*");
}

export async function handleGoogleAuth(authId: string, scopes: string[]): Promise<void> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GOOGLE_AUTH; payload: { scopes: string[] } },
      { ok: boolean; state: GooglePublicAuthState }
    >({ type: BG_MSG.GOOGLE_AUTH, payload: { scopes } });

    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_AUTH_RESPONSE,
      payload: { authId, success: resp.ok, state: resp.state }
    }, "*");
  } catch (e) {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_AUTH_RESPONSE,
      payload: { authId, success: false, error: String(e) }
    }, "*");
  }
}

export async function handleGoogleLogout(logoutId: string): Promise<void> {
  try {
    await sendRuntimeMessage({ type: BG_MSG.GOOGLE_LOGOUT });
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_LOGOUT_RESPONSE,
      payload: { logoutId, success: true }
    }, "*");
  } catch {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_LOGOUT_RESPONSE,
      payload: { logoutId, success: false }
    }, "*");
  }
}

export async function handleGoogleState(stateId: string): Promise<void> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GOOGLE_GET_STATE },
      { ok: boolean; state: GooglePublicAuthState }
    >({ type: BG_MSG.GOOGLE_GET_STATE });

    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_STATE_RESPONSE,
      payload: { stateId, state: resp.state }
    }, "*");
  } catch {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_STATE_RESPONSE,
      payload: { stateId, state: { authenticated: false, email: null, scopes: [] } }
    }, "*");
  }
}

export async function handleGoogleHasScopes(scopesId: string, scopes: string[]): Promise<void> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GOOGLE_HAS_SCOPES; payload: { scopes: string[] } },
      { ok: boolean; hasScopes: boolean }
    >({ type: BG_MSG.GOOGLE_HAS_SCOPES, payload: { scopes } });

    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_HAS_SCOPES_RESPONSE,
      payload: { scopesId, hasScopes: resp.hasScopes }
    }, "*");
  } catch {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_HAS_SCOPES_RESPONSE,
      payload: { scopesId, hasScopes: false }
    }, "*");
  }
}

export async function handleGoogleFetch(req: GoogleFetchRequest): Promise<void> {
  const domain = resolveCurrentDomain();
  if (!domain) {
    sendBlockedGoogleFetchResponse(req.requestId, "Bridge domain resolution failed for this frame.");
    return;
  }
  const status = getDomainStatusCache() ?? await fetchDomainStatus(domain);
  if (!isBridgeEnabled(status)) {
    log.info("Blocked Google fetch: bridge disabled for domain", domain);
    sendBlockedGoogleFetchResponse(req.requestId, BRIDGE_DISABLED_MESSAGE);
    return;
  }

  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GOOGLE_FETCH; payload: GoogleFetchRequest },
      GoogleFetchResponse
    >({ type: BG_MSG.GOOGLE_FETCH, payload: req });

    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_FETCH_RESPONSE,
      payload: resp
    }, "*");
  } catch (e) {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.GOOGLE_FETCH_RESPONSE,
      payload: {
        requestId: req.requestId,
        ok: false,
        status: 0,
        statusText: "Error",
        headers: {},
        bodyText: "",
        error: String(e)
      }
    }, "*");
  }
}
