import type {
  BridgeSettings,
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
  CLEAR_LOGS: "FRANZAI_CLEAR_LOGS"
} as const;

export const BG_EVT = {
  LOGS_UPDATED: "FRANZAI_LOGS_UPDATED",
  SETTINGS_UPDATED: "FRANZAI_SETTINGS_UPDATED"
} as const;

export const PAGE_MSG = {
  FETCH_REQUEST: "FETCH_REQUEST",
  FETCH_ABORT: "FETCH_ABORT",
  FETCH_RESPONSE: "FETCH_RESPONSE",
  BRIDGE_READY: "BRIDGE_READY"
} as const;

export type BgMessage =
  | { type: typeof BG_MSG.FETCH; payload: FetchRequestFromPage }
  | { type: typeof BG_MSG.FETCH_ABORT; payload: { requestId: string } }
  | { type: typeof BG_MSG.GET_SETTINGS }
  | { type: typeof BG_MSG.SET_SETTINGS; payload: BridgeSettings }
  | { type: typeof BG_MSG.GET_LOGS }
  | { type: typeof BG_MSG.CLEAR_LOGS };

export type BgEvent =
  | { type: typeof BG_EVT.LOGS_UPDATED }
  | { type: typeof BG_EVT.SETTINGS_UPDATED };

export type PageToContentMessage =
  | { source: string; type: typeof PAGE_MSG.FETCH_REQUEST; payload: PageFetchRequest }
  | { source: string; type: typeof PAGE_MSG.FETCH_ABORT; payload: { requestId: string } }
  | { source: string; type: typeof PAGE_MSG.BRIDGE_READY; payload: { version: string } };

export type ContentToPageMessage =
  | { source: string; type: typeof PAGE_MSG.FETCH_RESPONSE; payload: FetchEnvelope };
