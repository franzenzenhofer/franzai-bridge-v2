import type {
  BridgeSettings,
  BridgeStatus,
  DomainPreferences,
  FetchEnvelope,
  FetchRequestFromPage,
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
  REMOVE_DOMAIN_PREF: "FRANZAI_REMOVE_DOMAIN_PREF"
} as const;

export const BG_EVT = {
  LOGS_UPDATED: "FRANZAI_LOGS_UPDATED",
  SETTINGS_UPDATED: "FRANZAI_SETTINGS_UPDATED",
  DOMAIN_PREFS_UPDATED: "FRANZAI_DOMAIN_PREFS_UPDATED"
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
  DOMAIN_ENABLED_UPDATE: "DOMAIN_ENABLED_UPDATE"
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
  | { type: typeof BG_MSG.REMOVE_DOMAIN_PREF; payload: { domain: string } };

export type BgEvent =
  | { type: typeof BG_EVT.LOGS_UPDATED }
  | { type: typeof BG_EVT.SETTINGS_UPDATED }
  | { type: typeof BG_EVT.DOMAIN_PREFS_UPDATED };

export type PageToContentMessage =
  | { source: string; type: typeof PAGE_MSG.FETCH_REQUEST; payload: PageFetchRequest }
  | { source: string; type: typeof PAGE_MSG.FETCH_ABORT; payload: { requestId: string } }
  | { source: string; type: typeof PAGE_MSG.BRIDGE_READY; payload: { version: string } }
  | { source: string; type: typeof PAGE_MSG.KEY_CHECK_REQUEST; payload: { checkId: string; keyName: string } }
  | { source: string; type: typeof PAGE_MSG.KEYS_REQUEST; payload: { keysId: string } }
  | { source: string; type: typeof PAGE_MSG.STATUS_REQUEST; payload: { statusId: string } };

export type ContentToPageMessage =
  | { source: string; type: typeof PAGE_MSG.FETCH_RESPONSE; payload: FetchEnvelope }
  | { source: string; type: typeof PAGE_MSG.KEY_CHECK_RESPONSE; payload: { checkId: string; isSet: boolean } }
  | { source: string; type: typeof PAGE_MSG.KEYS_RESPONSE; payload: { keysId: string; keys: string[] } }
  | { source: string; type: typeof PAGE_MSG.KEYS_UPDATE; payload: { keys: string[] } }
  | { source: string; type: typeof PAGE_MSG.STATUS_RESPONSE; payload: { statusId: string; status: BridgeStatus } }
  | { source: string; type: typeof PAGE_MSG.DOMAIN_ENABLED_UPDATE; payload: { enabled: boolean; source: string } };
