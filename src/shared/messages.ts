import type {
  BridgeSettings,
  BridgeStatus,
  DomainPreferences,
  FetchEnvelope,
  FetchRequestFromPage,
  GoogleFetchRequest,
  GoogleFetchResponse,
  GooglePublicAuthState,
  PageFetchRequest
} from "./types";

export const BG_MSG = {
  FETCH: "FRANZAI_FETCH",
  FETCH_ABORT: "FRANZAI_FETCH_ABORT",
  GET_SETTINGS: "FRANZAI_GET_SETTINGS",
  SET_SETTINGS: "FRANZAI_SET_SETTINGS",
  GET_LOGS: "FRANZAI_GET_LOGS",
  CLEAR_LOGS: "FRANZAI_CLEAR_LOGS",
  IS_KEY_SET: "FRANZAI_IS_KEY_SET",
  GET_KEY_NAMES: "FRANZAI_GET_KEY_NAMES",
  // Domain preference messages
  GET_DOMAIN_STATUS: "FRANZAI_GET_DOMAIN_STATUS",
  SET_DOMAIN_ENABLED: "FRANZAI_SET_DOMAIN_ENABLED",
  GET_ALL_DOMAIN_PREFS: "FRANZAI_GET_ALL_DOMAIN_PREFS",
  REPORT_META_TAG: "FRANZAI_REPORT_META_TAG",
  REMOVE_DOMAIN_PREF: "FRANZAI_REMOVE_DOMAIN_PREF",
  // Google OAuth messages
  GOOGLE_AUTH: "FRANZAI_GOOGLE_AUTH",
  GOOGLE_LOGOUT: "FRANZAI_GOOGLE_LOGOUT",
  GOOGLE_GET_STATE: "FRANZAI_GOOGLE_GET_STATE",
  GOOGLE_HAS_SCOPES: "FRANZAI_GOOGLE_HAS_SCOPES",
  GOOGLE_FETCH: "FRANZAI_GOOGLE_FETCH"
} as const;

export const BG_EVT = {
  LOGS_UPDATED: "FRANZAI_LOGS_UPDATED",
  SETTINGS_UPDATED: "FRANZAI_SETTINGS_UPDATED",
  DOMAIN_PREFS_UPDATED: "FRANZAI_DOMAIN_PREFS_UPDATED",
  GOOGLE_AUTH_UPDATED: "FRANZAI_GOOGLE_AUTH_UPDATED"
} as const;

export const PAGE_MSG = {
  FETCH_REQUEST: "FETCH_REQUEST",
  FETCH_ABORT: "FETCH_ABORT",
  FETCH_RESPONSE: "FETCH_RESPONSE",
  BRIDGE_READY: "BRIDGE_READY",
  KEY_CHECK_REQUEST: "KEY_CHECK_REQUEST",
  KEY_CHECK_RESPONSE: "KEY_CHECK_RESPONSE",
  KEYS_REQUEST: "KEYS_REQUEST",
  KEYS_RESPONSE: "KEYS_RESPONSE",
  KEYS_UPDATE: "KEYS_UPDATE",
  STATUS_REQUEST: "STATUS_REQUEST",
  STATUS_RESPONSE: "STATUS_RESPONSE",
  DOMAIN_ENABLED_UPDATE: "DOMAIN_ENABLED_UPDATE",
  // Google OAuth page messages
  GOOGLE_AUTH_REQUEST: "GOOGLE_AUTH_REQUEST",
  GOOGLE_AUTH_RESPONSE: "GOOGLE_AUTH_RESPONSE",
  GOOGLE_LOGOUT_REQUEST: "GOOGLE_LOGOUT_REQUEST",
  GOOGLE_LOGOUT_RESPONSE: "GOOGLE_LOGOUT_RESPONSE",
  GOOGLE_STATE_REQUEST: "GOOGLE_STATE_REQUEST",
  GOOGLE_STATE_RESPONSE: "GOOGLE_STATE_RESPONSE",
  GOOGLE_HAS_SCOPES_REQUEST: "GOOGLE_HAS_SCOPES_REQUEST",
  GOOGLE_HAS_SCOPES_RESPONSE: "GOOGLE_HAS_SCOPES_RESPONSE",
  GOOGLE_FETCH_REQUEST: "GOOGLE_FETCH_REQUEST",
  GOOGLE_FETCH_RESPONSE: "GOOGLE_FETCH_RESPONSE",
  GOOGLE_AUTH_UPDATE: "GOOGLE_AUTH_UPDATE"
} as const;

export type BgMessage =
  | { type: typeof BG_MSG.FETCH; payload: FetchRequestFromPage }
  | { type: typeof BG_MSG.FETCH_ABORT; payload: { requestId: string } }
  | { type: typeof BG_MSG.GET_SETTINGS }
  | { type: typeof BG_MSG.SET_SETTINGS; payload: BridgeSettings }
  | { type: typeof BG_MSG.GET_LOGS }
  | { type: typeof BG_MSG.CLEAR_LOGS }
  | { type: typeof BG_MSG.IS_KEY_SET; payload: { keyName: string } }
  | { type: typeof BG_MSG.GET_KEY_NAMES }
  | { type: typeof BG_MSG.GET_DOMAIN_STATUS; payload: { domain: string } }
  | { type: typeof BG_MSG.SET_DOMAIN_ENABLED; payload: { domain: string; enabled: boolean } }
  | { type: typeof BG_MSG.GET_ALL_DOMAIN_PREFS }
  | { type: typeof BG_MSG.REPORT_META_TAG; payload: { domain: string; enabled: boolean } }
  | { type: typeof BG_MSG.REMOVE_DOMAIN_PREF; payload: { domain: string } }
  | { type: typeof BG_MSG.GOOGLE_AUTH; payload: { scopes: string[] } }
  | { type: typeof BG_MSG.GOOGLE_LOGOUT }
  | { type: typeof BG_MSG.GOOGLE_GET_STATE }
  | { type: typeof BG_MSG.GOOGLE_HAS_SCOPES; payload: { scopes: string[] } }
  | { type: typeof BG_MSG.GOOGLE_FETCH; payload: GoogleFetchRequest };

export type BgEvent =
  | { type: typeof BG_EVT.LOGS_UPDATED }
  | { type: typeof BG_EVT.SETTINGS_UPDATED }
  | { type: typeof BG_EVT.DOMAIN_PREFS_UPDATED }
  | { type: typeof BG_EVT.GOOGLE_AUTH_UPDATED; payload: GooglePublicAuthState };

export type PageToContentMessage =
  | { source: string; type: typeof PAGE_MSG.FETCH_REQUEST; payload: PageFetchRequest }
  | { source: string; type: typeof PAGE_MSG.FETCH_ABORT; payload: { requestId: string } }
  | { source: string; type: typeof PAGE_MSG.BRIDGE_READY; payload: { version: string } }
  | { source: string; type: typeof PAGE_MSG.KEY_CHECK_REQUEST; payload: { checkId: string; keyName: string } }
  | { source: string; type: typeof PAGE_MSG.KEYS_REQUEST; payload: { keysId: string } }
  | { source: string; type: typeof PAGE_MSG.STATUS_REQUEST; payload: { statusId: string } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_AUTH_REQUEST; payload: { authId: string; scopes: string[] } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_LOGOUT_REQUEST; payload: { logoutId: string } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_STATE_REQUEST; payload: { stateId: string } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_HAS_SCOPES_REQUEST; payload: { scopesId: string; scopes: string[] } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_FETCH_REQUEST; payload: GoogleFetchRequest };

export type ContentToPageMessage =
  | { source: string; type: typeof PAGE_MSG.FETCH_RESPONSE; payload: FetchEnvelope }
  | { source: string; type: typeof PAGE_MSG.KEY_CHECK_RESPONSE; payload: { checkId: string; isSet: boolean } }
  | { source: string; type: typeof PAGE_MSG.KEYS_RESPONSE; payload: { keysId: string; keys: string[] } }
  | { source: string; type: typeof PAGE_MSG.KEYS_UPDATE; payload: { keys: string[] } }
  | { source: string; type: typeof PAGE_MSG.STATUS_RESPONSE; payload: { statusId: string; status: BridgeStatus } }
  | { source: string; type: typeof PAGE_MSG.DOMAIN_ENABLED_UPDATE; payload: { enabled: boolean; source: string } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_AUTH_RESPONSE; payload: { authId: string; success: boolean; state?: GooglePublicAuthState; error?: string } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_LOGOUT_RESPONSE; payload: { logoutId: string; success: boolean } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_STATE_RESPONSE; payload: { stateId: string; state: GooglePublicAuthState } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_HAS_SCOPES_RESPONSE; payload: { scopesId: string; hasScopes: boolean } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_FETCH_RESPONSE; payload: GoogleFetchResponse }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_AUTH_UPDATE; payload: GooglePublicAuthState };
