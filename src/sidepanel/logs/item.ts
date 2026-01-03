import type { LogEntry } from "../../shared/types";
import { fmtShortTime, fmtTs } from "../utils/format";

function getStatusClass(status: number | undefined, error: string | undefined): string {
  if (error) return "error";
  if (!status) return "";
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 400) return "error";
  return "";
}

export function createLogItem(log: LogEntry, selectedLogId: string | null): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "item" + (log.id === selectedLogId ? " active" : "");

  const status = log.error ? "ERR" : log.status ?? "...";
  const statusClass = getStatusClass(log.status, log.error);
  const ms = log.elapsedMs != null ? `${log.elapsedMs}` : "—";

  let host = "";
  let path = log.url;
  try {
    const u = new URL(log.url);
    host = u.host;
    path = u.pathname + u.search;
    if (path.length > 40) path = path.substring(0, 37) + "...";
  } catch {
    // Keep full URL as path.
  }

  const tsDiv = document.createElement("div");
  tsDiv.className = "ts";
  tsDiv.textContent = fmtShortTime(log.ts);
  tsDiv.title = fmtTs(log.ts);
  div.appendChild(tsDiv);

  const methodDiv = document.createElement("div");
  methodDiv.className = "method " + log.method;
  methodDiv.textContent = log.method;
  div.appendChild(methodDiv);

  const hostDiv = document.createElement("div");
  hostDiv.className = "host";
  hostDiv.textContent = host;
  hostDiv.title = host;
  div.appendChild(hostDiv);

  const urlDiv = document.createElement("div");
  urlDiv.className = "url";
  urlDiv.textContent = path;
  urlDiv.title = log.url;
  div.appendChild(urlDiv);

  const statusDiv = document.createElement("div");
  statusDiv.className = "status-code " + statusClass;
  statusDiv.textContent = String(status);
  div.appendChild(statusDiv);

  const elapsedDiv = document.createElement("div");
  elapsedDiv.className = "elapsed";
  elapsedDiv.textContent = ms;
  div.appendChild(elapsedDiv);

  return div;
}
