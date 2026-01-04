import type { LogEntry } from "../../shared/types";
import { fmtTs } from "../utils/format";
import { highlightJson } from "../utils/html";
import { copyToClipboard } from "../ui/clipboard";
import { removeLog } from "../data/settings";
import { state } from "../state";

function createSection(title: string, content: string, id: string, useHighlight = true): HTMLElement {
  const section = document.createElement("div");
  section.className = "detail-section";

  const header = document.createElement("div");
  header.className = "section-header";

  const titleEl = document.createElement("span");
  titleEl.className = "section-title";
  titleEl.textContent = title;

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copy";
  copyBtn.onclick = (e) => {
    e.stopPropagation();
    copyToClipboard(content, copyBtn);
  };

  header.appendChild(titleEl);
  header.appendChild(copyBtn);
  header.onclick = () => {
    section.classList.toggle("collapsed");
  };

  const pre = document.createElement("pre");
  pre.id = id;
  if (useHighlight && (content.startsWith("{") || content.startsWith("["))) {
    pre.innerHTML = highlightJson(content);
  } else {
    pre.textContent = content;
  }

  section.appendChild(header);
  section.appendChild(pre);
  return section;
}

export function renderDetails(log: LogEntry): void {
  const details = document.getElementById("details");
  if (!details) return;
  details.innerHTML = "";

  const topBar = document.createElement("div");
  topBar.className = "detail-top-bar";

  const copyUrlBtn = document.createElement("button");
  copyUrlBtn.className = "copy-url-btn";
  copyUrlBtn.textContent = "Copy URL";
  copyUrlBtn.onclick = () => copyToClipboard(log.url, copyUrlBtn);

  const copyCurlBtn = document.createElement("button");
  copyCurlBtn.className = "copy-url-btn";
  copyCurlBtn.textContent = "Copy cURL";
  copyCurlBtn.onclick = () => copyToClipboard(buildCurlCommand(log), copyCurlBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "copy-url-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.onclick = async () => {
    await removeLog(log.id);
    state.logs = state.logs.filter((entry) => entry.id !== log.id);
    state.selectedLogId = null;
    const { renderLogs } = await import("./render");
    renderLogs();
  };

  const copyAllBtn = document.createElement("button");
  copyAllBtn.className = "copy-all-btn";
  copyAllBtn.textContent = "Copy All";
  copyAllBtn.onclick = () => {
    const allData = {
      request: {
        requestId: log.requestId,
        ts: fmtTs(log.ts),
        tabId: log.tabId,
        pageOrigin: log.pageOrigin,
        method: log.method,
        url: log.url,
        headers: log.requestHeaders,
        body: log.requestBodyPreview || undefined
      },
      response: {
        status: log.status,
        statusText: log.statusText,
        elapsedMs: log.elapsedMs,
        error: log.error || undefined,
        headers: log.responseHeaders,
        body: log.responseBodyPreview || undefined
      }
    };
    copyToClipboard(JSON.stringify(allData, null, 2), copyAllBtn);
  };

  const closeBtn = document.createElement("button");
  closeBtn.className = "close-detail-btn";
  closeBtn.innerHTML = "✕";
  closeBtn.title = "Close (Esc)";
  closeBtn.onclick = () => {
    const detailPane = document.getElementById("detailPane");
    if (detailPane) detailPane.classList.remove("visible");
  };

  const left = document.createElement("div");
  left.className = "detail-top-bar-left";
  left.appendChild(copyUrlBtn);
  left.appendChild(copyCurlBtn);
  left.appendChild(copyAllBtn);
  left.appendChild(deleteBtn);

  topBar.appendChild(left);
  topBar.appendChild(closeBtn);
  details.appendChild(topBar);

  const requestData = JSON.stringify({ method: log.method, url: log.url, headers: log.requestHeaders }, null, 2);
  details.appendChild(createSection("Request Headers", requestData, "req-headers"));

  if (log.requestBodyPreview && log.requestBodyPreview.trim()) {
    details.appendChild(createSection("Request Body", log.requestBodyPreview, "req-body", false));
  }

  const responseData = JSON.stringify({
    status: log.status,
    statusText: log.statusText,
    elapsedMs: log.elapsedMs,
    error: log.error || undefined,
    headers: log.responseHeaders
  }, null, 2);
  details.appendChild(createSection("Response Headers", responseData, "resp-headers"));

  if (log.responseBodyPreview && log.responseBodyPreview.trim()) {
    details.appendChild(createSection("Response Body", log.responseBodyPreview, "resp-body", false));
  }

  const metaData = JSON.stringify({
    requestId: log.requestId,
    ts: fmtTs(log.ts),
    tabId: log.tabId,
    pageOrigin: log.pageOrigin
  }, null, 2);
  details.appendChild(createSection("Meta", metaData, "meta"));
}

function buildCurlCommand(log: LogEntry): string {
  const parts: string[] = [];
  parts.push(`curl -X ${log.method} '${escapeShell(log.url)}'`);

  for (const [key, value] of Object.entries(log.requestHeaders ?? {})) {
    parts.push(`-H '${escapeShell(`${key}: ${value}`)}'`);
  }

  if (log.requestBodyPreview) {
    parts.push(`--data '${escapeShell(log.requestBodyPreview)}'`);
  }

  return parts.join(" \\\n  ");
}

function escapeShell(value: string): string {
  return value.replace(/'/g, "'\\''");
}
