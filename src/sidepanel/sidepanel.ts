import type { BridgeSettings, Dict, InjectionRule, LogEntry } from "../shared/types";
import { BG_EVT, BG_MSG, type BgEvent } from "../shared/messages";
import { createLogger } from "../shared/logger";
import { sendRuntimeMessage } from "../shared/runtime";
import { BRIDGE_VERSION } from "../shared/constants";

type BgResp<T> = {
  ok: boolean;
  settings?: BridgeSettings;
  logs?: LogEntry[];
  error?: string;
  response?: T;
};

const log = createLogger("sidepanel");

function qs<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

let settings: BridgeSettings | null = null;
let logs: LogEntry[] = [];
let selectedLogId: string | null = null;

const logsList = qs<HTMLDivElement>("logsList");
const details = qs<HTMLDivElement>("details");
const statusEl = qs<HTMLDivElement>("status");

// Column widths (persisted)
const DEFAULT_COL_WIDTHS = [50, 45, -1, 45, 40]; // -1 = flex
let colWidths = [...DEFAULT_COL_WIDTHS];

// Sorting state
type SortColumn = "ts" | "method" | "url" | "status" | "elapsed";
type SortDir = "asc" | "desc";
let sortColumn: SortColumn = "ts";
let sortDir: SortDir = "desc"; // Newest first by default

// Detail pane height (persisted)
let detailHeight = 60; // percentage

function setStatus(text: string, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function fmtTs(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function fmtShortTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStatusClass(status: number | undefined, error: string | undefined): string {
  if (error) return "error";
  if (!status) return "";
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 400) return "error";
  return "";
}

function createLogItem(l: LogEntry): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "item" + (l.id === selectedLogId ? " active" : "");

  const status = l.error ? "ERR" : l.status ?? "...";
  const statusClass = getStatusClass(l.status, l.error);
  const ms = l.elapsedMs != null ? `${l.elapsedMs}` : "—";

  // Extract just the path for display (compact for sidebar)
  let displayUrl = l.url;
  try {
    const u = new URL(l.url);
    displayUrl = u.pathname + u.search;
    if (displayUrl.length > 40) {
      displayUrl = displayUrl.substring(0, 37) + "...";
    }
  } catch {
    // Keep full URL
  }

  // Time column (first)
  const tsDiv = document.createElement("div");
  tsDiv.className = "ts";
  tsDiv.textContent = fmtShortTime(l.ts);
  tsDiv.title = fmtTs(l.ts);
  div.appendChild(tsDiv);

  // Method column
  const methodDiv = document.createElement("div");
  methodDiv.className = "method " + l.method;
  methodDiv.textContent = l.method;
  div.appendChild(methodDiv);

  // URL column
  const urlDiv = document.createElement("div");
  urlDiv.className = "url";
  urlDiv.textContent = displayUrl;
  urlDiv.title = l.url;
  div.appendChild(urlDiv);

  // Status column
  const statusDiv = document.createElement("div");
  statusDiv.className = "status-code " + statusClass;
  statusDiv.textContent = String(status);
  div.appendChild(statusDiv);

  // Elapsed ms column (last)
  const elapsedDiv = document.createElement("div");
  elapsedDiv.className = "elapsed";
  elapsedDiv.textContent = ms;
  div.appendChild(elapsedDiv);

  return div;
}

function closeDetailPane() {
  selectedLogId = null;
  const detailPane = document.getElementById("detailPane");
  if (detailPane) detailPane.classList.remove("visible");
  // Remove active class from all items
  document.querySelectorAll(".item.active").forEach(el => el.classList.remove("active"));
}

function sortLogs(logsToSort: LogEntry[]): LogEntry[] {
  const sorted = [...logsToSort];
  const dir = sortDir === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case "ts":
        cmp = a.ts - b.ts;
        break;
      case "method":
        cmp = a.method.localeCompare(b.method);
        break;
      case "url":
        cmp = a.url.localeCompare(b.url);
        break;
      case "status":
        cmp = (a.status ?? 0) - (b.status ?? 0);
        break;
      case "elapsed":
        cmp = (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0);
        break;
    }
    return cmp * dir;
  });

  return sorted;
}

function updateSortIndicators() {
  document.querySelectorAll(".table-header .sortable").forEach(el => {
    el.classList.remove("asc", "desc");
    if (el.getAttribute("data-col") === sortColumn) {
      el.classList.add(sortDir);
    }
  });
}

function renderLogs() {
  while (logsList.firstChild) {
    logsList.removeChild(logsList.firstChild);
  }
  const detailPane = document.getElementById("detailPane");

  if (!logs.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "No requests captured yet. Make fetch calls to see them here.";
    logsList.appendChild(hint);
    if (detailPane) detailPane.classList.remove("visible");
    return;
  }

  // Sort logs based on current sort state
  const sortedLogs = sortLogs(logs);

  for (const l of sortedLogs) {
    const div = createLogItem(l);

    div.onclick = () => {
      // Toggle: click same row again to close
      if (selectedLogId === l.id) {
        closeDetailPane();
        return;
      }
      selectedLogId = l.id;
      // Update active states
      document.querySelectorAll(".item.active").forEach(el => el.classList.remove("active"));
      div.classList.add("active");
      renderDetails(l);
      if (detailPane) detailPane.classList.add("visible");
    };

    logsList.appendChild(div);
  }

  // Auto-scroll to bottom when sorted by time desc (newest at bottom)
  if (sortColumn === "ts" && sortDir === "desc") {
    logsList.scrollTop = logsList.scrollHeight;
  }

  // Update sort indicators in header
  updateSortIndicators();

  // Show detail pane if something is selected
  if (selectedLogId && detailPane) {
    detailPane.classList.add("visible");
  }
}

function copyToClipboard(text: string, btn: HTMLButtonElement) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1000);
  });
}

function createSection(title: string, content: string, id: string): HTMLElement {
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

  const pre = document.createElement("pre");
  pre.id = id;
  pre.textContent = content;

  section.appendChild(header);
  section.appendChild(pre);

  return section;
}

function renderDetails(l: LogEntry) {
  details.innerHTML = "";

  // Top bar with Copy All and Close buttons
  const topBar = document.createElement("div");
  topBar.className = "detail-top-bar";

  const copyAllBtn = document.createElement("button");
  copyAllBtn.className = "copy-all-btn";
  copyAllBtn.textContent = "Copy All";

  const closeBtn = document.createElement("button");
  closeBtn.className = "close-detail-btn";
  closeBtn.innerHTML = "✕";
  closeBtn.title = "Close (Esc)";
  closeBtn.onclick = () => closeDetailPane();
  copyAllBtn.onclick = () => {
    const allData = {
      request: {
        requestId: l.requestId,
        ts: fmtTs(l.ts),
        tabId: l.tabId,
        pageOrigin: l.pageOrigin,
        method: l.method,
        url: l.url,
        headers: l.requestHeaders,
        body: l.requestBodyPreview || undefined
      },
      response: {
        status: l.status,
        statusText: l.statusText,
        elapsedMs: l.elapsedMs,
        error: l.error || undefined,
        headers: l.responseHeaders,
        body: l.responseBodyPreview || undefined
      }
    };
    copyToClipboard(JSON.stringify(allData, null, 2), copyAllBtn);
  };

  topBar.appendChild(copyAllBtn);
  topBar.appendChild(closeBtn);
  details.appendChild(topBar);

  // Request Headers section
  const requestData = JSON.stringify({
    method: l.method,
    url: l.url,
    headers: l.requestHeaders
  }, null, 2);
  details.appendChild(createSection("Request Headers", requestData, "req-headers"));

  // Request Body section (only if not empty)
  if (l.requestBodyPreview && l.requestBodyPreview.trim()) {
    details.appendChild(createSection("Request Body", l.requestBodyPreview, "req-body"));
  }

  // Response Headers section
  const responseData = JSON.stringify({
    status: l.status,
    statusText: l.statusText,
    elapsedMs: l.elapsedMs,
    error: l.error || undefined,
    headers: l.responseHeaders
  }, null, 2);
  details.appendChild(createSection("Response Headers", responseData, "resp-headers"));

  // Response Body section (only if not empty)
  if (l.responseBodyPreview && l.responseBodyPreview.trim()) {
    details.appendChild(createSection("Response Body", l.responseBodyPreview, "resp-body"));
  }

  // Meta info at bottom
  const metaData = JSON.stringify({
    requestId: l.requestId,
    ts: fmtTs(l.ts),
    tabId: l.tabId,
    pageOrigin: l.pageOrigin
  }, null, 2);
  details.appendChild(createSection("Meta", metaData, "meta"));
}

// Toast notification system (no more alerts!)
function showToast(message: string, isError = false) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast" + (isError ? " error" : "");
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("visible"), 10);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// SVG Icons (MIT licensed, from Feather Icons)
const ICON_EDIT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_TRASH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

// DRY: Unified list table renderer
type ListTableConfig = {
  tableId: string;
  items: string[];
  emptyText: string;
  onDelete: (value: string) => Promise<void>;
  onEdit?: (oldValue: string, newValue: string) => Promise<void>;
};

function renderListTable(config: ListTableConfig) {
  const table = qs<HTMLDivElement>(config.tableId);
  table.innerHTML = "";

  if (!config.items.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = config.emptyText;
    table.appendChild(hint);
    return;
  }

  for (const v of config.items) {
    const tr = document.createElement("div");
    tr.className = "tr";

    const tdValue = document.createElement("div");
    tdValue.className = "td";
    tdValue.textContent = v;

    const tdActions = document.createElement("div");
    tdActions.className = "td actions";

    if (config.onEdit) {
      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.innerHTML = ICON_EDIT;
      editBtn.title = "Edit";
      editBtn.onclick = () => startInlineEdit(tr, tdValue, v, config.onEdit!);
      tdActions.appendChild(editBtn);
    }

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.innerHTML = ICON_TRASH;
    delBtn.title = "Delete";
    delBtn.onclick = () => config.onDelete(v);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdValue);
    tr.appendChild(tdActions);
    table.appendChild(tr);
  }
}

function startInlineEdit(
  row: HTMLElement,
  cell: HTMLElement,
  currentValue: string,
  onSave: (oldValue: string, newValue: string) => Promise<void>
) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentValue;
  input.className = "inline-edit";

  const originalContent = cell.textContent;
  cell.textContent = "";
  cell.appendChild(input);
  input.focus();
  input.select();

  const save = async () => {
    const newValue = input.value.trim();
    if (newValue && newValue !== currentValue) {
      await onSave(currentValue, newValue);
    } else {
      cell.textContent = originalContent;
    }
  };

  input.onblur = save;
  input.onkeydown = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") {
      cell.textContent = originalContent;
    }
  };
}

function renderEnvTable() {
  const envTable = qs<HTMLDivElement>("envTable");
  envTable.innerHTML = "";

  const env = settings?.env ?? {};
  const keys = Object.keys(env).sort((a, b) => a.localeCompare(b));

  if (!keys.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "No ENV vars configured.";
    envTable.appendChild(hint);
    return;
  }

  for (const k of keys) {
    const value = env[k];
    const hasValue = value && value.trim() !== "";

    const tr = document.createElement("div");
    tr.className = "tr env-row";

    const tdKey = document.createElement("div");
    tdKey.className = "td env-key";
    tdKey.textContent = k;

    const tdValue = document.createElement("div");
    tdValue.className = "td env-value";
    if (hasValue) {
      tdValue.textContent = "••••••••";
      tdValue.title = "Value is set (hidden for security)";
    } else {
      tdValue.textContent = "Not set";
      tdValue.classList.add("not-set");
    }

    const tdActions = document.createElement("div");
    tdActions.className = "td actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.innerHTML = ICON_EDIT;
    editBtn.title = hasValue ? "Edit" : "Set value";
    editBtn.onclick = () => showEnvEditModal(k, env[k] || "");
    tdActions.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.innerHTML = ICON_TRASH;
    delBtn.title = "Delete";
    delBtn.onclick = async () => {
      if (!settings) return;
      const next = structuredClone(settings);
      delete next.env[k];
      await saveSettings(next);
      showToast(`Deleted ${k}`);
    };
    tdActions.appendChild(delBtn);

    tr.appendChild(tdKey);
    tr.appendChild(tdValue);
    tr.appendChild(tdActions);
    envTable.appendChild(tr);
  }
}

function showEnvEditModal(key: string, currentValue: string) {
  // Create modal overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  const title = document.createElement("div");
  title.className = "modal-title";
  title.textContent = `Edit ${key}`;

  const input = document.createElement("input");
  input.type = "text";
  input.value = currentValue;
  input.placeholder = `Enter value for ${key}`;
  input.className = "modal-input";

  const btnRow = document.createElement("div");
  btnRow.className = "modal-buttons";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => overlay.remove();

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary";
  saveBtn.textContent = "Save";
  saveBtn.onclick = async () => {
    if (!settings) return;
    const next = structuredClone(settings);
    next.env[key] = input.value;
    await saveSettings(next);
    overlay.remove();
    showToast(`Updated ${key}`);
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);

  modal.appendChild(title);
  modal.appendChild(input);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  input.focus();
  input.select();

  // Close on Escape
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    if (e.key === "Enter") {
      saveBtn.click();
    }
  };
  document.addEventListener("keydown", onKey);

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}

function renderOriginsTable() {
  renderListTable({
    tableId: "originsTable",
    items: settings?.allowedOrigins ?? [],
    emptyText: "No origins allowed (everything blocked).",
    onDelete: async (v) => {
      if (!settings) return;
      const next = structuredClone(settings);
      next.allowedOrigins = next.allowedOrigins.filter((x) => x !== v);
      await saveSettings(next);
      showToast("Origin removed");
    },
    onEdit: async (oldVal, newVal) => {
      if (!settings) return;
      const next = structuredClone(settings);
      const idx = next.allowedOrigins.indexOf(oldVal);
      if (idx >= 0) next.allowedOrigins[idx] = newVal;
      await saveSettings(next);
      showToast("Origin updated");
    }
  });
}

function renderDestsTable() {
  renderListTable({
    tableId: "destsTable",
    items: settings?.allowedDestinations ?? [],
    emptyText: "No destinations allowed (everything blocked).",
    onDelete: async (v) => {
      if (!settings) return;
      const next = structuredClone(settings);
      next.allowedDestinations = next.allowedDestinations.filter((x) => x !== v);
      await saveSettings(next);
      showToast("Destination removed");
    },
    onEdit: async (oldVal, newVal) => {
      if (!settings) return;
      const next = structuredClone(settings);
      const idx = next.allowedDestinations.indexOf(oldVal);
      if (idx >= 0) next.allowedDestinations[idx] = newVal;
      await saveSettings(next);
      showToast("Destination updated");
    }
  });
}

function renderRulesTable() {
  const table = qs<HTMLDivElement>("rulesTable");
  table.innerHTML = "";

  const items = settings?.injectionRules ?? [];
  if (!items.length) {
    table.innerHTML = `<div class="hint">No custom rules.</div>`;
    return;
  }

  items.forEach((r, idx) => {
    const tr = document.createElement("div");
    tr.className = "tr";

    const tdValue = document.createElement("div");
    tdValue.className = "td";
    tdValue.innerHTML = `
      <b>${escapeHtml(r.hostPattern)}</b><br />
      <span style="color: var(--muted)">headers:</span> ${escapeHtml(
        JSON.stringify(r.injectHeaders ?? {})
      )}<br />
      <span style="color: var(--muted)">query:</span> ${escapeHtml(
        JSON.stringify(r.injectQuery ?? {})
      )}
    `;

    const tdActions = document.createElement("div");
    tdActions.className = "td actions";

    const btn = document.createElement("button");
    btn.className = "icon-btn";
    btn.innerHTML = ICON_TRASH;
    btn.title = "Delete rule";
    btn.onclick = async () => {
      if (!settings) return;
      const next = structuredClone(settings);
      next.injectionRules.splice(idx, 1);
      await saveSettings(next);
      showToast("Rule deleted");
    };

    tdActions.appendChild(btn);
    tr.appendChild(tdValue);
    tr.appendChild(tdActions);
    table.appendChild(tr);
  });
}

function renderSettings() {
  renderEnvTable();
  renderOriginsTable();
  renderDestsTable();
  renderRulesTable();
}

async function loadAll() {
  setStatus("Loading...");

  try {
    const s = await sendRuntimeMessage<{ type: typeof BG_MSG.GET_SETTINGS }, BgResp<never>>({
      type: BG_MSG.GET_SETTINGS
    });
    if (s.ok && s.settings) settings = s.settings;

    const l = await sendRuntimeMessage<{ type: typeof BG_MSG.GET_LOGS }, BgResp<never>>({
      type: BG_MSG.GET_LOGS
    });
    if (l.ok && l.logs) logs = l.logs;

    setStatus(`Loaded ${logs.length} logs at ${new Date().toLocaleTimeString()}`);
  } catch (e) {
    log.error("Failed to load state from background", e);
    setStatus("Failed to load - check extension console", true);
  }

  renderLogs();
  renderSettings();

  if (selectedLogId && !logs.some((x) => x.id === selectedLogId)) {
    selectedLogId = null;
    details.innerHTML = `<div class="hint">Select a request to inspect.</div>`;
  }
}

async function saveSettings(next: BridgeSettings) {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.SET_SETTINGS; payload: BridgeSettings },
      BgResp<never>
    >({
      type: BG_MSG.SET_SETTINGS,
      payload: next
    });

    if (!resp.ok) {
      showToast(resp.error ?? "Failed to save settings", true);
      return;
    }

    settings = next;
    renderSettings();
    setStatus("Settings saved");
  } catch (e) {
    log.error("Failed to save settings", e);
    showToast("Failed to save settings", true);
    setStatus("Failed to save settings", true);
  }
}

function parseJsonOrEmpty<T>(txt: string): T | undefined {
  if (!txt) return undefined;
  return JSON.parse(txt) as T;
}

qs<HTMLButtonElement>("btnRefresh").onclick = () => loadAll();

qs<HTMLButtonElement>("btnClearLogs").onclick = async () => {
  try {
    await sendRuntimeMessage<{ type: typeof BG_MSG.CLEAR_LOGS }, BgResp<never>>({
      type: BG_MSG.CLEAR_LOGS
    });
    await loadAll();
    showToast("Logs cleared");
  } catch (e) {
    log.error("Failed to clear logs", e);
    showToast("Failed to clear logs", true);
    setStatus("Failed to clear logs", true);
  }
};

qs<HTMLButtonElement>("btnResetSettings").onclick = async () => {
  if (!confirm("Reset all settings to defaults? This will clear your API keys and custom rules.")) {
    return;
  }
  try {
    await chrome.storage.local.clear();
    setStatus("Settings reset to defaults");
    await loadAll();
    showToast("Settings reset to defaults");
  } catch (e) {
    log.error("Failed to reset settings", e);
    showToast("Failed to reset settings", true);
    setStatus("Failed to reset settings", true);
  }
};

qs<HTMLButtonElement>("btnAddEnv").onclick = async () => {
  if (!settings) return;

  const nameInput = qs<HTMLInputElement>("envName");
  const valueInput = qs<HTMLInputElement>("envValue");
  const name = nameInput.value.trim();
  const value = valueInput.value;

  if (!name) {
    nameInput.classList.add("error");
    nameInput.focus();
    showToast("ENV name required", true);
    setTimeout(() => nameInput.classList.remove("error"), 2000);
    return;
  }

  const next = structuredClone(settings);
  next.env[name] = value;

  nameInput.value = "";
  valueInput.value = "";

  await saveSettings(next);
  showToast(`Added ${name}`);
};

qs<HTMLButtonElement>("btnAddOrigin").onclick = async () => {
  if (!settings) return;
  const input = qs<HTMLInputElement>("originValue");
  const v = input.value.trim();
  if (!v) {
    input.focus();
    return;
  }

  const next = structuredClone(settings);
  if (!next.allowedOrigins.includes(v)) {
    next.allowedOrigins.push(v);
    input.value = "";
    await saveSettings(next);
    showToast("Origin added");
  } else {
    showToast("Origin already exists", true);
  }
};

qs<HTMLButtonElement>("btnAddDest").onclick = async () => {
  if (!settings) return;
  const input = qs<HTMLInputElement>("destValue");
  const v = input.value.trim();
  if (!v) {
    input.focus();
    return;
  }

  const next = structuredClone(settings);
  if (!next.allowedDestinations.includes(v)) {
    next.allowedDestinations.push(v);
    input.value = "";
    await saveSettings(next);
    showToast("Destination added");
  } else {
    showToast("Destination already exists", true);
  }
};

qs<HTMLButtonElement>("btnAddRule").onclick = async () => {
  if (!settings) return;

  const hostInput = qs<HTMLInputElement>("ruleHost");
  const headersInput = qs<HTMLTextAreaElement>("ruleHeaders");
  const queryInput = qs<HTMLTextAreaElement>("ruleQuery");

  const hostPattern = hostInput.value.trim();
  const headersJson = headersInput.value.trim();
  const queryJson = queryInput.value.trim();

  if (!hostPattern) {
    hostInput.classList.add("error");
    hostInput.focus();
    showToast("Host pattern required", true);
    setTimeout(() => hostInput.classList.remove("error"), 2000);
    return;
  }

  let injectHeaders: Dict<string> | undefined;
  let injectQuery: Dict<string> | undefined;
  try {
    injectHeaders = parseJsonOrEmpty<Dict<string>>(headersJson);
    injectQuery = parseJsonOrEmpty<Dict<string>>(queryJson);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    showToast(`Invalid JSON: ${errorMsg}`, true);
    return;
  }

  const rule: InjectionRule = {
    hostPattern,
    injectHeaders,
    injectQuery
  };

  const next = structuredClone(settings);
  next.injectionRules.push(rule);

  hostInput.value = "";
  headersInput.value = "";
  queryInput.value = "";

  await saveSettings(next);
  showToast("Rule added");
};

/** Tab switching */
function switchTab(tab: "requests" | "settings" | "advanced") {
  const requestsPage = document.getElementById("tab-requests");
  const settingsPage = document.getElementById("tab-settings");
  const advancedPage = document.getElementById("tab-advanced");
  const requestsToolbar = document.getElementById("toolbar-requests");
  const settingsToolbar = document.getElementById("toolbar-settings");
  const advancedToolbar = document.getElementById("toolbar-advanced");
  const settingsBtn = document.getElementById("btnSettings");

  // Hide all
  requestsPage?.classList.remove("active");
  settingsPage?.classList.remove("active");
  advancedPage?.classList.remove("active");
  requestsToolbar?.classList.add("hidden");
  settingsToolbar?.classList.add("hidden");
  advancedToolbar?.classList.add("hidden");
  settingsBtn?.classList.remove("active");

  // Show selected
  if (tab === "settings") {
    settingsPage?.classList.add("active");
    settingsToolbar?.classList.remove("hidden");
    settingsBtn?.classList.add("active");
  } else if (tab === "advanced") {
    advancedPage?.classList.add("active");
    advancedToolbar?.classList.remove("hidden");
    settingsBtn?.classList.add("active");
  } else {
    requestsPage?.classList.add("active");
    requestsToolbar?.classList.remove("hidden");
  }
}

qs<HTMLButtonElement>("btnSettings").onclick = () => switchTab("settings");
qs<HTMLButtonElement>("btnBackToRequests").onclick = () => switchTab("requests");
qs<HTMLButtonElement>("btnBackToSettings").onclick = () => switchTab("settings");
qs<HTMLElement>("advancedLink").onclick = () => switchTab("advanced");

const port = chrome.runtime.connect({ name: "FRANZAI_SIDEPANEL" });
port.onMessage.addListener(async (evt: BgEvent) => {
  if (evt.type === BG_EVT.LOGS_UPDATED || evt.type === BG_EVT.SETTINGS_UPDATED) {
    await loadAll();
  }
});

/** Keyboard navigation */
document.addEventListener("keydown", (e) => {
  // Escape closes detail pane
  if (e.key === "Escape" && selectedLogId) {
    closeDetailPane();
  }
});

/** Sortable column headers */
document.querySelectorAll<HTMLElement>(".table-header .sortable").forEach(el => {
  el.onclick = () => {
    const col = el.getAttribute("data-col") as SortColumn;
    if (!col) return;

    if (sortColumn === col) {
      // Toggle direction
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      // New column, default to desc for time, asc for others
      sortColumn = col;
      sortDir = col === "ts" ? "desc" : "asc";
    }

    renderLogs();
  };
});

/** Resizable split pane */
function initResizableSplit() {
  const layout = document.querySelector(".requests-layout") as HTMLElement;
  const listPane = document.querySelector(".listPane") as HTMLElement;
  const detailPane = document.querySelector(".detailPane") as HTMLElement;

  if (!layout || !listPane || !detailPane) return;

  // Create resize handle
  const resizer = document.createElement("div");
  resizer.className = "split-resizer";
  layout.insertBefore(resizer, detailPane);

  let startY = 0;
  let startHeight = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientY - startY;
    const newHeight = Math.max(50, Math.min(startHeight + delta, layout.clientHeight - 100));
    listPane.style.height = newHeight + "px";
    listPane.style.maxHeight = "none";
    listPane.style.flex = "none";
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = listPane.offsetHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

/** Resizable columns */
function initResizableColumns() {
  const header = document.querySelector(".table-header") as HTMLElement;
  if (!header) return;

  const cols = header.querySelectorAll("div");
  cols.forEach((col, index) => {
    if (index === cols.length - 1) return; // Skip last column

    const resizer = document.createElement("div");
    resizer.className = "col-resizer";
    col.style.position = "relative";
    col.appendChild(resizer);

    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(30, startWidth + delta);
      updateColumnWidth(index, newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startWidth = col.offsetWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });
}

function updateColumnWidth(index: number, width: number) {
  colWidths[index] = width;
  applyColumnWidths();
}

function applyColumnWidths() {
  const template = colWidths.map(w => w === -1 ? "1fr" : w + "px").join(" ");

  const header = document.querySelector(".table-header") as HTMLElement;
  if (header) header.style.gridTemplateColumns = template;

  document.querySelectorAll(".item").forEach((item) => {
    (item as HTMLElement).style.gridTemplateColumns = template;
  });
}

// Initialize resize handlers after DOM ready
setTimeout(() => {
  initResizableSplit();
  initResizableColumns();
}, 100);

// Display version
const versionEl = document.getElementById("version");
if (versionEl) versionEl.textContent = `v${BRIDGE_VERSION}`;

loadAll();
