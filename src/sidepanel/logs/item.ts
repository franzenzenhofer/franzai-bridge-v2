import type { LogEntry } from "../../shared/types";
import { fmtShortTime, fmtTs } from "../utils/format";
import {
  deriveLogLifecycle,
  getStatusDisplay,
  getStatusTitle,
  type LogLifecycle
} from "./stage";

type LogItemRenderState = {
  lifecycle?: LogLifecycle;
  isNew?: boolean;
  didLifecycleChange?: boolean;
};

export function createLogItem(
  log: LogEntry,
  selectedLogId: string | null,
  renderState: LogItemRenderState = {}
): HTMLDivElement {
  const lifecycle = renderState.lifecycle ?? deriveLogLifecycle(log);
  const div = document.createElement("div");
  div.className = "item" + (log.id === selectedLogId ? " active" : "");
  if (lifecycle.inFlight) div.classList.add("in-flight");
  if (renderState.isNew) div.classList.add("is-new");
  if (renderState.didLifecycleChange) div.classList.add("stage-changed");
  div.dataset.lifecycle = lifecycle.stage;

  const status = getStatusDisplay(log, lifecycle);
  const ms = log.elapsedMs != null ? `${log.elapsedMs}` : lifecycle.inFlight ? "…" : "—";

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
  statusDiv.className = `status-code ${lifecycle.statusClass}`;
  statusDiv.textContent = String(status);
  statusDiv.title = getStatusTitle(log, lifecycle);
  div.appendChild(statusDiv);

  const elapsedDiv = document.createElement("div");
  elapsedDiv.className = "elapsed";
  elapsedDiv.textContent = ms;
  div.appendChild(elapsedDiv);

  return div;
}
