import type { FetchEnvelope, FetchResponseToPage, LogEntry } from "../../shared/types";
import { BG_EVT, type BgEvent } from "../../shared/messages";
import { appendLog } from "../../shared/storage";

export function makeErrorResponse(
  requestId: string,
  statusText: string,
  message: string,
  elapsedMs: number
): FetchResponseToPage {
  return { requestId, ok: false, status: 0, statusText, headers: {}, bodyText: "", elapsedMs, error: message };
}

export async function finalizeWithError(args: {
  requestId: string;
  statusText: string;
  message: string;
  started: number;
  logEntry: LogEntry;
  maxLogs: number;
  broadcast: (evt: BgEvent) => void;
}): Promise<FetchEnvelope> {
  const { requestId, statusText, message, started, logEntry, maxLogs, broadcast } = args;
  const elapsedMs = Date.now() - started;
  logEntry.status = 0;
  logEntry.statusText = statusText;
  logEntry.error = message;
  logEntry.elapsedMs = elapsedMs;

  await appendLog(logEntry, maxLogs);
  broadcast({ type: BG_EVT.LOGS_UPDATED });

  return { ok: false, response: makeErrorResponse(requestId, statusText, message, elapsedMs), error: message };
}
