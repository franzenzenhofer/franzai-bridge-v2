import type { LogEntry } from "../../shared/types";

export type LogLifecycleStage =
  | "queued"
  | "sending"
  | "receiving"
  | "streaming"
  | "success"
  | "redirect"
  | "error"
  | "aborted"
  | "timeout";

export type LogLifecycle = {
  stage: LogLifecycleStage;
  label: string;
  shortLabel: string;
  inFlight: boolean;
  statusClass: "pending" | "success" | "redirect" | "error";
};

const STAGE_META: Record<LogLifecycleStage, Omit<LogLifecycle, "stage">> = {
  queued: { label: "Queued", shortLabel: "Q", inFlight: true, statusClass: "pending" },
  sending: { label: "Sending", shortLabel: "SEND", inFlight: true, statusClass: "pending" },
  receiving: { label: "Receiving", shortLabel: "RECV", inFlight: true, statusClass: "pending" },
  streaming: { label: "Streaming", shortLabel: "STRM", inFlight: true, statusClass: "pending" },
  success: { label: "Success", shortLabel: "", inFlight: false, statusClass: "success" },
  redirect: { label: "Redirect", shortLabel: "", inFlight: false, statusClass: "redirect" },
  error: { label: "Error", shortLabel: "ERR", inFlight: false, statusClass: "error" },
  aborted: { label: "Aborted", shortLabel: "ABRT", inFlight: false, statusClass: "error" },
  timeout: { label: "Timeout", shortLabel: "TIME", inFlight: false, statusClass: "error" }
};

function toLower(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function detectErrorStage(log: LogEntry, statusTextLower: string): LogLifecycleStage {
  const errorLower = toLower(log.error);
  if (statusTextLower.includes("timeout") || errorLower.includes("timed out")) {
    return "timeout";
  }
  if (statusTextLower.includes("abort") || errorLower.includes("aborted")) {
    return "aborted";
  }
  return "error";
}

export function deriveLogLifecycle(log: LogEntry): LogLifecycle {
  const statusTextLower = toLower(log.statusText);

  let stage: LogLifecycleStage;
  if (log.error) {
    stage = detectErrorStage(log, statusTextLower);
  } else if (statusTextLower.includes("pending") || statusTextLower.includes("queued")) {
    stage = "queued";
  } else if (statusTextLower.includes("sending")) {
    stage = "sending";
  } else if (statusTextLower.includes("receiving")) {
    stage = "receiving";
  } else if (statusTextLower.includes("stream")) {
    stage = "streaming";
  } else if (typeof log.status === "number") {
    if (log.status >= 200 && log.status < 300) {
      stage = "success";
    } else if (log.status >= 300 && log.status < 400) {
      stage = "redirect";
    } else if (log.status >= 400) {
      stage = "error";
    } else {
      stage = "sending";
    }
  } else {
    stage = log.elapsedMs != null ? "sending" : "queued";
  }

  return {
    stage,
    ...STAGE_META[stage]
  };
}

export function getStatusDisplay(log: LogEntry, lifecycle: LogLifecycle): string {
  if (!lifecycle.inFlight && typeof log.status === "number" && log.status > 0) {
    return String(log.status);
  }
  return lifecycle.shortLabel;
}

export function getStatusTitle(log: LogEntry, lifecycle: LogLifecycle): string {
  if (lifecycle.inFlight) {
    return lifecycle.label;
  }
  if (log.error) {
    return `${lifecycle.label}: ${log.error}`;
  }
  if (typeof log.status === "number") {
    const statusText = (log.statusText ?? "").trim();
    return statusText ? `${log.status} ${statusText}` : `${log.status}`;
  }
  return lifecycle.label;
}
