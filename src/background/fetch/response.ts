import type { Dict, FetchResponseToPage, LogEntry } from "../../shared/types";
import { isEventStream, isTextualResponse } from "../../shared/content-type";
import { RESPONSE_BODY_PREVIEW_LIMIT } from "../../shared/constants";
import { previewBody } from "./preview";

export type ResponseReadResult = {
  response: FetchResponseToPage;
  responseHeaders: Dict<string>;
  bodyPreview: string;
  elapsedMs: number;
  eventStream: boolean;
};

export async function readResponse(args: {
  requestId: string;
  res: Response;
  started: number;
}): Promise<ResponseReadResult> {
  const { requestId, res, started } = args;
  const headersObj: Dict<string> = {};
  res.headers.forEach((value, key) => { headersObj[key] = value; });

  const contentType = res.headers.get("content-type");
  const eventStream = isEventStream(contentType);

  let bodyText = "";
  let bodyBytes: Uint8Array | undefined;
  if (isTextualResponse(contentType)) {
    bodyText = await res.text();
  } else {
    const buffer = await res.arrayBuffer();
    bodyBytes = new Uint8Array(buffer);
  }

  const elapsedMs = Date.now() - started;
  const response: FetchResponseToPage = {
    requestId,
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers: headersObj,
    bodyText,
    bodyBytes,
    elapsedMs
  };

  return {
    response,
    responseHeaders: headersObj,
    bodyPreview: previewBody(bodyBytes ?? bodyText, RESPONSE_BODY_PREVIEW_LIMIT),
    elapsedMs,
    eventStream
  };
}

export function applyResponseToLog(logEntry: LogEntry, result: ResponseReadResult): void {
  logEntry.status = result.response.status;
  logEntry.statusText = result.response.statusText;
  logEntry.responseHeaders = result.responseHeaders;
  logEntry.responseBodyPreview = result.bodyPreview;
  logEntry.elapsedMs = result.elapsedMs;
}
