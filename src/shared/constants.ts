declare const __BRIDGE_VERSION__: string;

export const BRIDGE_SOURCE = "FRANZAI_BRIDGE" as const;
export const BRIDGE_VERSION = __BRIDGE_VERSION__;

export const BRIDGE_TIMEOUT_MS = 30_000;
export const FETCH_TIMEOUT_MS = 25_000;
export const MAX_BODY_BYTES = 5 * 1024 * 1024;
export const STREAM_HEADER_TIMEOUT_MS = 25_000;
export const STREAM_CHUNK_BYTES = 64 * 1024;

export const REQUEST_BODY_PREVIEW_LIMIT = 25_000;
export const RESPONSE_BODY_PREVIEW_LIMIT = 50_000;

export const MIN_LOGS_LIMIT = 10;
export const MAX_LOGS_LIMIT = 1000;

export const RUNTIME_MESSAGE_TIMEOUT_MS = 15_000;

export const STREAM_PORT_NAME = "FRANZAI_STREAM";
export const WS_PORT_NAME = "FRANZAI_WS";
