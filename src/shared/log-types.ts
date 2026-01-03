import type { Dict } from "./bridge-types";

export type LogEntry = {
  id: string;
  requestId: string;
  ts: number;
  tabId?: number;
  pageOrigin: string;
  url: string;
  method: string;
  requestHeaders: Dict<string>;
  requestBodyPreview: string;
  status?: number;
  statusText?: string;
  responseHeaders?: Dict<string>;
  responseBodyPreview?: string;
  elapsedMs?: number;
  error?: string;
};
