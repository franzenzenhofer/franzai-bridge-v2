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
import type {
  StreamHeadersPayload,
  StreamChunkPayload,
  StreamEndPayload,
  StreamErrorPayload
} from "./stream-types";
import type {
  WebSocketOpenPayload,
  WebSocketSendPayload,
  WebSocketMessagePayload,
  WebSocketClosePayload,
  WebSocketErrorPayload
} from "./ws-types";
import { BG_MSG, BG_EVT, PAGE_MSG } from "./messages";

export type BgMessage =
  | { type: typeof BG_MSG.FETCH; payload: FetchRequestFromPage }
  | { type: typeof BG_MSG.FETCH_ABORT; payload: { requestId: string } }
  | { type: typeof BG_MSG.GET_SETTINGS }
  | { type: typeof BG_MSG.SET_SETTINGS; payload: BridgeSettings }
  | { type: typeof BG_MSG.GET_LOGS }
  | { type: typeof BG_MSG.CLEAR_LOGS }
  | { type: typeof BG_MSG.REMOVE_LOG; payload: { logId: string } }
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
  | { type: typeof BG_MSG.GOOGLE_FETCH; payload: GoogleFetchRequest }
  | { type: typeof BG_MSG.STREAM_INIT };

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
  | { source: string; type: typeof PAGE_MSG.STREAM_REQUEST; payload: PageFetchRequest }
  | { source: string; type: typeof PAGE_MSG.STREAM_ABORT; payload: { requestId: string } }
  | { source: string; type: typeof PAGE_MSG.STREAM_PAUSE; payload: { requestId: string } }
  | { source: string; type: typeof PAGE_MSG.STREAM_RESUME; payload: { requestId: string } }
  | { source: string; type: typeof PAGE_MSG.WS_CONNECT; payload: WebSocketOpenPayload }
  | { source: string; type: typeof PAGE_MSG.WS_SEND; payload: WebSocketSendPayload }
  | { source: string; type: typeof PAGE_MSG.WS_CLOSE; payload: WebSocketClosePayload }
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
  | { source: string; type: typeof PAGE_MSG.STREAM_HEADERS; payload: StreamHeadersPayload }
  | { source: string; type: typeof PAGE_MSG.STREAM_CHUNK; payload: StreamChunkPayload }
  | { source: string; type: typeof PAGE_MSG.STREAM_END; payload: StreamEndPayload }
  | { source: string; type: typeof PAGE_MSG.STREAM_ERROR; payload: StreamErrorPayload }
  | { source: string; type: typeof PAGE_MSG.WS_OPEN; payload: { socketId: string; protocol?: string } }
  | { source: string; type: typeof PAGE_MSG.WS_MESSAGE; payload: WebSocketMessagePayload }
  | { source: string; type: typeof PAGE_MSG.WS_ERROR; payload: WebSocketErrorPayload }
  | { source: string; type: typeof PAGE_MSG.WS_CLOSED; payload: WebSocketClosePayload }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_AUTH_RESPONSE; payload: { authId: string; success: boolean; state?: GooglePublicAuthState; error?: string } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_LOGOUT_RESPONSE; payload: { logoutId: string; success: boolean } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_STATE_RESPONSE; payload: { stateId: string; state: GooglePublicAuthState } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_HAS_SCOPES_RESPONSE; payload: { scopesId: string; hasScopes: boolean } }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_FETCH_RESPONSE; payload: GoogleFetchResponse }
  | { source: string; type: typeof PAGE_MSG.GOOGLE_AUTH_UPDATE; payload: GooglePublicAuthState };
