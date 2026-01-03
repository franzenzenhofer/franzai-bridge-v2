export const WS_MSG = {
  OPEN: "FRANZAI_WS_OPEN",
  SEND: "FRANZAI_WS_SEND",
  MESSAGE: "FRANZAI_WS_MESSAGE",
  CLOSE: "FRANZAI_WS_CLOSE",
  ERROR: "FRANZAI_WS_ERROR"
} as const;

export type WebSocketOpenPayload = {
  socketId: string;
  url: string;
  protocols?: string[];
  pageOrigin: string;
};

export type WebSocketSendPayload = {
  socketId: string;
  data: string | Uint8Array;
};

export type WebSocketMessagePayload = {
  socketId: string;
  data: string | Uint8Array;
};

export type WebSocketClosePayload = {
  socketId: string;
  code?: number;
  reason?: string;
  wasClean?: boolean;
};

export type WebSocketErrorPayload = {
  socketId: string;
  message: string;
};

export type WebSocketPortMessage =
  | { type: typeof WS_MSG.OPEN; payload: WebSocketOpenPayload }
  | { type: typeof WS_MSG.SEND; payload: WebSocketSendPayload }
  | { type: typeof WS_MSG.MESSAGE; payload: WebSocketMessagePayload }
  | { type: typeof WS_MSG.CLOSE; payload: WebSocketClosePayload }
  | { type: typeof WS_MSG.ERROR; payload: WebSocketErrorPayload };
