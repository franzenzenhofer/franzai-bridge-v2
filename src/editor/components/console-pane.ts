/**
 * Bridge AI IDE - Console Pane Component
 */

import { el } from "../utils/dom";
import { getState, subscribe, clearLogs, addLog } from "../state/store";
import type { ConsoleLog } from "../state/types";

export function initConsolePane(): void {
  const container = document.getElementById("console-pane");
  if (!container) return;

  render();
  subscribe((state, changed) => {
    if (changed.includes("logs")) {
      render();
    }
  });

  // Setup console message listener
  setupConsoleListener();
}

function render(): void {
  const container = document.getElementById("console-pane");
  if (!container) return;

  const state = getState();

  // Clear using DOM method
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Header
  const header = el("div", "console-header");
  header.appendChild(el("span", "console-title", "Console"));

  const clearBtn = el("button", "console-clear-btn", "Clear");
  clearBtn.onclick = () => clearLogs();
  header.appendChild(clearBtn);

  container.appendChild(header);

  // Logs list
  const logsContainer = el("div", "console-logs");

  if (state.logs.length === 0) {
    const empty = el("div", "console-empty", "No console output");
    logsContainer.appendChild(empty);
  } else {
    for (const log of state.logs) {
      logsContainer.appendChild(renderLog(log));
    }
    // Auto-scroll to bottom
    requestAnimationFrame(() => {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    });
  }

  container.appendChild(logsContainer);
}

function renderLog(log: ConsoleLog): HTMLElement {
  const row = el("div", "console-log");

  const type = el("span", `console-log-type ${log.type}`, log.type.toUpperCase());
  row.appendChild(type);

  const message = el("span", "console-log-message", log.message);
  row.appendChild(message);

  const time = el("span", "console-log-time");
  time.textContent = new Date(log.timestamp).toLocaleTimeString();
  row.appendChild(time);

  return row;
}

// Listen for console messages from preview iframe
function setupConsoleListener(): void {
  window.addEventListener("message", (event) => {
    if (event.data?.type === "console") {
      const method = event.data.method as "log" | "warn" | "error" | "info";
      const args = event.data.args as string[];
      addLog(method, args.join(" "));
    }
  });
}
