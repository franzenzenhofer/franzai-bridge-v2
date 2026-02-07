import type { Dict } from "./bridge-types";
import type { FetchInitLite } from "./fetch-types";

export const STREAM_MSG = {
  START: "FRANZAI_STREAM_START",
  HEADERS: "FRANZAI_STREAM_HEADERS",
  CHUNK: "FRANZAI_STREAM_CHUNK",
  END: "FRANZAI_STREAM_END",
  ERROR: "FRANZAI_STREAM_ERROR",
  ABORT: "FRANZAI_STREAM_ABORT",
  PAUSE: "FRANZAI_STREAM_PAUSE",
  RESUME: "FRANZAI_STREAM_RESUME",
  PING: "FRANZAI_STREAM_PING"
} as const;

export type StreamStartPayload = {
  requestId: string;
  url: string;
  init?: FetchInitLite;
  pageOrigin: string;
};

export type StreamHeadersPayload = {
  requestId: string;
  status: number;
  statusText: string;
  headers: Dict<string>;
};

export type StreamChunkPayload = {
  requestId: string;
  chunk: Uint8Array | number[];
};

export type StreamEndPayload = {
  requestId: string;
};

export type StreamErrorPayload = {
  requestId: string;
  message: string;
};

export type StreamAbortPayload = {
  requestId: string;
};

export type StreamPausePayload = {
  requestId: string;
};

export type StreamResumePayload = {
  requestId: string;
};

export type StreamPortMessage =
  | { type: typeof STREAM_MSG.START; payload: StreamStartPayload }
  | { type: typeof STREAM_MSG.HEADERS; payload: StreamHeadersPayload }
  | { type: typeof STREAM_MSG.CHUNK; payload: StreamChunkPayload }
  | { type: typeof STREAM_MSG.END; payload: StreamEndPayload }
  | { type: typeof STREAM_MSG.ERROR; payload: StreamErrorPayload }
  | { type: typeof STREAM_MSG.ABORT; payload: StreamAbortPayload }
  | { type: typeof STREAM_MSG.PAUSE; payload: StreamPausePayload }
  | { type: typeof STREAM_MSG.RESUME; payload: StreamResumePayload }
  | { type: typeof STREAM_MSG.PING };
