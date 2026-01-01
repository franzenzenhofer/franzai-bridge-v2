import type { BridgeSettings, BridgeStatus, Dict, DomainPreferences, InjectionRule, LogEntry } from "../shared/types";
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

// Domain state
let currentDomain: string | null = null;
let currentDomainStatus: BridgeStatus | null = null;
let allDomainPrefs: DomainPreferences = {};

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

// Column widths (persisted) - Time, Method, Host, Path, Status, ms
const DEFAULT_COL_WIDTHS = [50, 45, 90, -1, 45, 40]; // -1 = flex
let colWidths = [...DEFAULT_COL_WIDTHS];

// Sorting state
type SortColumn = "ts" | "method" | "host" | "url" | "status" | "elapsed";
type SortDir = "asc" | "desc";
let sortColumn: SortColumn = "ts";
let sortDir: SortDir = "desc"; // Newest first by default

// Filter state
let filterSearch = "";
let filterMethod = "";
let filterStatus = "";

// UI Preferences key for persistence
const UI_PREFS_KEY = "franzai_ui_prefs";

/** Simple debounce utility */
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  }) as T;
}

/** Error boundary wrapper for async functions */
function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error(`Error in ${context}:`, e);
      showToast(`Error: ${msg}`, true);
      return null;
    }
  }) as T;
}

/** Load UI preferences from storage */
async function loadUIPrefs() {
  try {
    const data = await chrome.storage.local.get(UI_PREFS_KEY);
    const prefs = data[UI_PREFS_KEY];
    if (prefs) {
      if (prefs.colWidths) colWidths = prefs.colWidths;
      if (prefs.sortColumn) sortColumn = prefs.sortColumn;
      if (prefs.sortDir) sortDir = prefs.sortDir;
    }
  } catch (e) {
    log.error("Failed to load UI preferences", e);
  }
}

/** Save UI preferences to storage */
const saveUIPrefs = debounce(async () => {
  try {
    await chrome.storage.local.set({
      [UI_PREFS_KEY]: { colWidths, sortColumn, sortDir }
    });
  } catch (e) {
    log.error("Failed to save UI preferences", e);
  }
}, 500);

/** Check if any filter is active */
function hasActiveFilters(): boolean {
  return filterSearch !== "" || filterMethod !== "" || filterStatus !== "";
}

/** Clear all filters */
function clearFilters() {
  filterSearch = "";
  filterMethod = "";
  filterStatus = "";

  const searchInput = document.getElementById("filterSearch") as HTMLInputElement;
  const methodSelect = document.getElementById("filterMethod") as HTMLSelectElement;
  const statusSelect = document.getElementById("filterStatus") as HTMLSelectElement;

  if (searchInput) searchInput.value = "";
  if (methodSelect) methodSelect.value = "";
  if (statusSelect) statusSelect.value = "";

  renderLogs();
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

/** JSON syntax highlighting */
function highlightJson(json: string): string {
  // Escape HTML first
  const escaped = escapeHtml(json);

  // Highlight different parts
  return escaped
    // Strings (including keys)
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
      // Check if it's a key (followed by :)
      return `<span class="json-string">"${content}"</span>`;
    })
    // Numbers
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>')
    // Booleans and null
    .replace(/\b(true|false|null)\b/g, '<span class="json-bool">$1</span>');
}

function createLogItem(l: LogEntry): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "item" + (l.id === selectedLogId ? " active" : "");

  const status = l.error ? "ERR" : l.status ?? "...";
  const statusClass = getStatusClass(l.status, l.error);
  const ms = l.elapsedMs != null ? `${l.elapsedMs}` : "—";

  // Extract host and path separately
  let host = "";
  let path = l.url;
  try {
    const u = new URL(l.url);
    host = u.host;
    path = u.pathname + u.search;
    if (path.length > 40) {
      path = path.substring(0, 37) + "...";
    }
  } catch {
    // Keep full URL as path
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

  // Host column
  const hostDiv = document.createElement("div");
  hostDiv.className = "host";
  hostDiv.textContent = host;
  hostDiv.title = host;
  div.appendChild(hostDiv);

  // Path column
  const urlDiv = document.createElement("div");
  urlDiv.className = "url";
  urlDiv.textContent = path;
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

function filterLogs(logsToFilter: LogEntry[]): LogEntry[] {
  return logsToFilter.filter(l => {
    // URL search
    if (filterSearch && !l.url.toLowerCase().includes(filterSearch.toLowerCase())) {
      return false;
    }
    // Method filter
    if (filterMethod && l.method !== filterMethod) {
      return false;
    }
    // Status filter
    if (filterStatus) {
      const status = l.status ?? 0;
      if (filterStatus === "success" && (status < 200 || status >= 300)) return false;
      if (filterStatus === "redirect" && (status < 300 || status >= 400)) return false;
      if (filterStatus === "error" && status < 400 && !l.error) return false;
    }
    return true;
  });
}

function getHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function getOriginHostname(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

function filterLogsByDomain(logsToFilter: LogEntry[]): LogEntry[] {
  if (!currentDomain) return [];
  return logsToFilter.filter(l => getOriginHostname(l.pageOrigin) === currentDomain);
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
      case "host":
        cmp = getHost(a.url).localeCompare(getHost(b.url));
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
  // Use DocumentFragment for batch DOM updates (better performance)
  const fragment = document.createDocumentFragment();
  logsList.innerHTML = "";
  const detailPane = document.getElementById("detailPane");

  if (!logs.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "No requests captured yet. Make fetch calls to see them here.";
    logsList.appendChild(hint);
    if (detailPane) detailPane.classList.remove("visible");
    updateFilterUI(0, 0);
    return;
  }

  const domainLogs = filterLogsByDomain(logs);
  if (!domainLogs.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = currentDomain
      ? `No requests for ${currentDomain} yet.`
      : "No active domain selected.";
    logsList.appendChild(hint);
    if (detailPane) detailPane.classList.remove("visible");
    updateFilterUI(0, 0);
    return;
  }

  // Filter then sort logs
  const filteredLogs = filterLogs(domainLogs);
  const sortedLogs = sortLogs(filteredLogs);

  // Update filter UI (count + clear button visibility)
  updateFilterUI(filteredLogs.length, domainLogs.length);

  // Show empty state if all filtered out
  if (!filteredLogs.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.innerHTML = `No requests match your filters. <a href="#" id="clearFiltersLink">Clear filters</a>`;
    logsList.appendChild(hint);
    const clearLink = document.getElementById("clearFiltersLink");
    if (clearLink) clearLink.onclick = (e) => { e.preventDefault(); clearFilters(); };
    if (detailPane) detailPane.classList.remove("visible");
    return;
  }

  if (selectedLogId && !filteredLogs.some(l => l.id === selectedLogId)) {
    closeDetailPane();
  }

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

    fragment.appendChild(div);
  }

  // Single DOM update for all items
  logsList.appendChild(fragment);

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

/** Update filter-related UI elements */
function updateFilterUI(filtered: number, total: number) {
  // Update request count badge
  const countEl = document.getElementById("requestCount");
  if (countEl) {
    countEl.textContent = filtered === total ? String(total) : `${filtered}/${total}`;
    countEl.classList.toggle("filtered", filtered !== total);
  }

  // Show/hide clear filters button
  const clearBtn = document.getElementById("btnClearFilters");
  if (clearBtn) {
    clearBtn.style.display = hasActiveFilters() ? "inline-flex" : "none";
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

  const pre = document.createElement("pre");
  pre.id = id;

  // Apply syntax highlighting for JSON content
  if (useHighlight && (content.startsWith("{") || content.startsWith("["))) {
    pre.innerHTML = highlightJson(content);
  } else {
    pre.textContent = content;
  }

  section.appendChild(header);
  section.appendChild(pre);

  return section;
}

function renderDetails(l: LogEntry) {
  details.innerHTML = "";

  // Top bar with Copy URL, Copy All and Close buttons
  const topBar = document.createElement("div");
  topBar.className = "detail-top-bar";

  const copyUrlBtn = document.createElement("button");
  copyUrlBtn.className = "copy-url-btn";
  copyUrlBtn.textContent = "Copy URL";
  copyUrlBtn.onclick = () => copyToClipboard(l.url, copyUrlBtn);

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

  const leftContainer = document.createElement("div");
  leftContainer.className = "detail-top-bar-left";
  leftContainer.appendChild(copyUrlBtn);
  leftContainer.appendChild(copyAllBtn);

  topBar.appendChild(leftContainer);
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

// Map of built-in keys to their target domains (for display)
const BUILTIN_KEY_TARGETS: Record<string, string> = {
  "OPENAI_API_KEY": "api.openai.com",
  "ANTHROPIC_API_KEY": "api.anthropic.com",
  "GOOGLE_API_KEY": "generativelanguage.googleapis.com",
  "MISTRAL_API_KEY": "api.mistral.ai"
};

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
    const isBuiltin = k in BUILTIN_KEY_TARGETS;

    // For custom keys, look up target from injection rules
    let targetDomain: string | null = BUILTIN_KEY_TARGETS[k] || null;
    if (!isBuiltin && settings?.injectionRules) {
      const rule = settings.injectionRules.find((r: InjectionRule) => {
        if (!r.injectHeaders) return false;
        return Object.values(r.injectHeaders).some((v) => v.includes(`\${${k}}`));
      });
      if (rule) {
        targetDomain = rule.hostPattern;
      }
    }

    // Card container
    const card = document.createElement("div");
    card.className = "env-card" + (hasValue ? " has-value" : " no-value");

    // Top row: key name + actions
    const topRow = document.createElement("div");
    topRow.className = "env-card-top";

    const keyName = document.createElement("div");
    keyName.className = "env-card-key";
    keyName.textContent = k;

    const actions = document.createElement("div");
    actions.className = "env-card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.innerHTML = ICON_EDIT;
    editBtn.title = hasValue ? "Edit" : "Set value";
    editBtn.onclick = () => showEnvEditModal(k, env[k] || "");
    actions.appendChild(editBtn);

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
    actions.appendChild(delBtn);

    topRow.appendChild(keyName);
    topRow.appendChild(actions);

    // Bottom row: target + value status
    const bottomRow = document.createElement("div");
    bottomRow.className = "env-card-bottom";

    const target = document.createElement("span");
    const hasTarget = targetDomain !== null;
    target.className = "env-card-target" + (hasTarget ? " builtin" : " custom");
    target.textContent = hasTarget ? `→ ${targetDomain}` : "→ No target (add rule)";
    target.title = hasTarget
      ? `Key only sent to ${targetDomain}`
      : "Add injection rule to specify target";

    const status = document.createElement("span");
    status.className = "env-card-status" + (hasValue ? " set" : " not-set");
    status.textContent = hasValue ? "✓ Set" : "⚠ Not set";

    bottomRow.appendChild(target);
    bottomRow.appendChild(status);

    card.appendChild(topRow);
    card.appendChild(bottomRow);
    envTable.appendChild(card);
  }
}

function showEnvEditModal(key: string, currentValue: string) {
  const isBuiltin = key in BUILTIN_KEY_TARGETS;

  // Look up target from built-in or rules
  let targetDomain: string | null = BUILTIN_KEY_TARGETS[key] || null;
  if (!isBuiltin && settings?.injectionRules) {
    const rule = settings.injectionRules.find((r: InjectionRule) => {
      if (!r.injectHeaders) return false;
      return Object.values(r.injectHeaders).some((v) => v.includes(`\${${key}}`));
    });
    if (rule) {
      targetDomain = rule.hostPattern;
    }
  }

  // Create modal overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal env-edit-modal";

  const title = document.createElement("div");
  title.className = "modal-title";
  title.textContent = `Edit ${key}`;

  // Target info row
  const targetRow = document.createElement("div");
  targetRow.className = "modal-field";
  const targetLabel = document.createElement("label");
  targetLabel.textContent = "Target";
  const targetValue = document.createElement("div");
  const hasTarget = targetDomain !== null;
  targetValue.className = "modal-target-value" + (hasTarget ? " builtin" : " custom");
  if (hasTarget) {
    targetValue.textContent = targetDomain!;
    targetValue.title = isBuiltin
      ? "Built-in key - target cannot be changed"
      : "Target set via injection rule";
  } else {
    targetValue.textContent = "No target (add injection rule)";
    targetValue.title = "Add a custom injection rule to specify target";
  }
  targetRow.appendChild(targetLabel);
  targetRow.appendChild(targetValue);

  // Value input row
  const valueRow = document.createElement("div");
  valueRow.className = "modal-field";
  const valueLabel = document.createElement("label");
  valueLabel.textContent = "Value";
  const input = document.createElement("input");
  input.type = "password";
  input.value = currentValue;
  input.placeholder = `Enter API key or secret`;
  input.className = "modal-input";
  valueRow.appendChild(valueLabel);
  valueRow.appendChild(input);

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
  modal.appendChild(targetRow);
  modal.appendChild(valueRow);
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

function showEnvAddModal() {
  // Create modal overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal env-edit-modal";

  const title = document.createElement("div");
  title.className = "modal-title";
  title.textContent = "Add ENV Variable";

  // Name input row
  const nameRow = document.createElement("div");
  nameRow.className = "modal-field";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "e.g. MY_API_KEY";
  nameInput.className = "modal-input";
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);

  // Target input row
  const targetRow = document.createElement("div");
  targetRow.className = "modal-field";
  const targetLabel = document.createElement("label");
  targetLabel.textContent = "Target Domain";
  const targetInput = document.createElement("input");
  targetInput.type = "text";
  targetInput.placeholder = "e.g. api.example.com";
  targetInput.className = "modal-input";
  const targetHint = document.createElement("div");
  targetHint.className = "modal-hint";
  targetHint.textContent = "Key will only be sent to this domain (creates injection rule)";
  targetRow.appendChild(targetLabel);
  targetRow.appendChild(targetInput);
  targetRow.appendChild(targetHint);

  // Value input row
  const valueRow = document.createElement("div");
  valueRow.className = "modal-field";
  const valueLabel = document.createElement("label");
  valueLabel.textContent = "Value";
  const valueInput = document.createElement("input");
  valueInput.type = "password";
  valueInput.placeholder = "Enter API key or secret";
  valueInput.className = "modal-input";
  valueRow.appendChild(valueLabel);
  valueRow.appendChild(valueInput);

  const btnRow = document.createElement("div");
  btnRow.className = "modal-buttons";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => overlay.remove();

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary";
  saveBtn.textContent = "Add";
  saveBtn.onclick = async () => {
    const name = nameInput.value.trim().toUpperCase();
    const target = targetInput.value.trim().toLowerCase();
    const value = valueInput.value;

    // Validate name
    if (!name) {
      nameInput.classList.add("error");
      nameInput.focus();
      showToast("Name is required", true);
      setTimeout(() => nameInput.classList.remove("error"), 2000);
      return;
    }

    // Validate target
    if (!target) {
      targetInput.classList.add("error");
      targetInput.focus();
      showToast("Target domain is required", true);
      setTimeout(() => targetInput.classList.remove("error"), 2000);
      return;
    }

    if (!settings) return;
    const next = structuredClone(settings);

    // 1. Add the ENV var
    next.env[name] = value;

    // 2. Create injection rule for this key -> target
    const newRule: InjectionRule = {
      hostPattern: target,
      injectHeaders: {
        "Authorization": `Bearer \${${name}}`
      }
    };

    // Check if rule already exists for this host with this key
    const existingRuleIdx = next.injectionRules.findIndex((r: InjectionRule) => {
      if (r.hostPattern !== target) return false;
      if (!r.injectHeaders) return false;
      return Object.values(r.injectHeaders).some((v) => v.includes(`\${${name}}`));
    });

    if (existingRuleIdx === -1) {
      next.injectionRules.push(newRule);
    }

    await saveSettings(next);
    overlay.remove();
    showToast(`Added ${name} → ${target}`);
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);

  modal.appendChild(title);
  modal.appendChild(nameRow);
  modal.appendChild(targetRow);
  modal.appendChild(valueRow);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  nameInput.focus();

  // Close on Escape, Enter to save
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    if (e.key === "Enter" && document.activeElement === valueInput) {
      saveBtn.click();
    }
  };
  document.addEventListener("keydown", onKey);

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
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

// =============================================================================
// Domain Functions
// =============================================================================

async function getCurrentTabDomain(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    const url = new URL(tab.url);
    // Skip chrome:// and extension pages
    if (url.protocol === "chrome:" || url.protocol === "chrome-extension:") {
      return null;
    }
    return url.hostname;
  } catch {
    return null;
  }
}

async function fetchDomainStatus(domain: string): Promise<BridgeStatus | null> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GET_DOMAIN_STATUS; payload: { domain: string } },
      { ok: boolean; status: BridgeStatus }
    >({
      type: BG_MSG.GET_DOMAIN_STATUS,
      payload: { domain }
    });
    return resp.ok ? resp.status : null;
  } catch (e) {
    log.error("Failed to fetch domain status", e);
    return null;
  }
}

async function fetchAllDomainPrefs(): Promise<DomainPreferences> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GET_ALL_DOMAIN_PREFS },
      { ok: boolean; prefs: DomainPreferences }
    >({
      type: BG_MSG.GET_ALL_DOMAIN_PREFS
    });
    return resp.ok ? resp.prefs : {};
  } catch (e) {
    log.error("Failed to fetch domain prefs", e);
    return {};
  }
}

async function setDomainEnabled(domain: string, enabled: boolean): Promise<void> {
  try {
    await sendRuntimeMessage({
      type: BG_MSG.SET_DOMAIN_ENABLED,
      payload: { domain, enabled }
    });
    showToast(`Bridge ${enabled ? "enabled" : "disabled"} for ${domain}`);
    // Refresh state
    await loadDomainState();
  } catch (e) {
    log.error("Failed to set domain enabled", e);
    showToast("Failed to update domain setting", true);
  }
}

async function removeDomainPref(domain: string): Promise<void> {
  try {
    await sendRuntimeMessage({
      type: BG_MSG.REMOVE_DOMAIN_PREF,
      payload: { domain }
    });
    showToast(`Removed preference for ${domain}`);
    // Refresh state
    await loadDomainState();
  } catch (e) {
    log.error("Failed to remove domain preference", e);
    showToast("Failed to remove domain preference", true);
  }
}

function updateDomainToggleUI() {
  const toggle = document.getElementById("domainToggle");
  const nameEl = document.getElementById("domainName");
  const checkbox = document.getElementById("domainEnabled") as HTMLInputElement | null;
  const sourceEl = document.getElementById("domainSource");

  if (!toggle || !nameEl || !checkbox || !sourceEl) return;

  if (!currentDomain) {
    toggle.classList.remove("enabled", "disabled");
    toggle.style.opacity = "0.5";
    nameEl.textContent = "—";
    checkbox.checked = false;
    checkbox.disabled = true;
    sourceEl.textContent = "";
    sourceEl.className = "domain-source";
    return;
  }

  toggle.style.opacity = "1";
  nameEl.textContent = currentDomain;
  nameEl.title = currentDomain;

  if (currentDomainStatus) {
    checkbox.checked = currentDomainStatus.domainEnabled;
    checkbox.disabled = false;
    toggle.classList.toggle("enabled", currentDomainStatus.domainEnabled);
    toggle.classList.toggle("disabled", !currentDomainStatus.domainEnabled);

    // Show source indicator (user/meta)
    if (currentDomainStatus.domainSource === "user") {
      sourceEl.textContent = "user";
      sourceEl.className = "domain-source user";
    } else if (currentDomainStatus.domainSource === "meta") {
      sourceEl.textContent = "meta";
      sourceEl.className = "domain-source meta";
    } else {
      sourceEl.textContent = "";
      sourceEl.className = "domain-source";
    }
  } else {
    checkbox.checked = false;
    checkbox.disabled = true;
    toggle.classList.remove("enabled");
    toggle.classList.add("disabled");
    sourceEl.textContent = "";
    sourceEl.className = "domain-source";
  }
}

async function loadDomainState() {
  const previousDomain = currentDomain;
  currentDomain = await getCurrentTabDomain();

  if (currentDomain) {
    currentDomainStatus = await fetchDomainStatus(currentDomain);
  } else {
    currentDomainStatus = null;
  }

  allDomainPrefs = await fetchAllDomainPrefs();

  updateDomainToggleUI();
  renderDomainsTable();
  if (previousDomain !== currentDomain) {
    closeDetailPane();
  }
  renderLogs();
}

function renderDomainsTable() {
  const table = document.getElementById("domainsTable");
  if (!table) return;

  table.innerHTML = "";

  const domains = Object.keys(allDomainPrefs).sort();

  if (!domains.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "No domain preferences yet. Enable the bridge on a page to add it here.";
    table.appendChild(hint);
    return;
  }

  for (const domain of domains) {
    const pref = allDomainPrefs[domain];
    const row = document.createElement("div");
    row.className = "domain-row " + (pref.enabled ? "enabled" : "disabled");

    const info = document.createElement("div");
    info.className = "domain-row-info";

    const name = document.createElement("div");
    name.className = "domain-row-name";
    name.textContent = domain;

    const meta = document.createElement("div");
    meta.className = "domain-row-meta";

    const sourceSpan = document.createElement("span");
    sourceSpan.className = "domain-row-source " + pref.source;
    sourceSpan.textContent = pref.source;
    meta.appendChild(sourceSpan);

    const timeSpan = document.createElement("span");
    const date = new Date(pref.lastModified);
    timeSpan.textContent = date.toLocaleDateString();
    timeSpan.title = date.toLocaleString();
    meta.appendChild(timeSpan);

    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "domain-row-actions";

    // Toggle for this domain
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle-switch";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = pref.enabled;
    toggleInput.onchange = () => setDomainEnabled(domain, toggleInput.checked);
    const toggleSlider = document.createElement("span");
    toggleSlider.className = "toggle-slider";
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleSlider);
    actions.appendChild(toggleLabel);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "domain-delete-btn";
    deleteBtn.title = "Remove preference";
    deleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    deleteBtn.onclick = () => removeDomainPref(domain);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);
    table.appendChild(row);
  }
}

function renderSettings() {
  renderEnvTable();
  renderDestsTable();
  renderRulesTable();
}

async function loadAll() {
  log.info("Loading...");

  try {
    const s = await sendRuntimeMessage<{ type: typeof BG_MSG.GET_SETTINGS }, BgResp<never>>({
      type: BG_MSG.GET_SETTINGS
    });
    if (s.ok && s.settings) settings = s.settings;

    const l = await sendRuntimeMessage<{ type: typeof BG_MSG.GET_LOGS }, BgResp<never>>({
      type: BG_MSG.GET_LOGS
    });
    if (l.ok && l.logs) logs = l.logs;

    log.info(`Loaded ${logs.length} logs`);
  } catch (e) {
    log.error("Failed to load state from background", e);
    showToast("Failed to load - check extension console", true);
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
    showToast("Settings saved");
  } catch (e) {
    log.error("Failed to save settings", e);
    showToast("Failed to save settings", true);
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
  }
};

qs<HTMLButtonElement>("btnResetSettings").onclick = async () => {
  if (!confirm("Reset all settings to defaults? This will clear your API keys and custom rules.")) {
    return;
  }
  try {
    await chrome.storage.local.clear();
    await loadAll();
    showToast("Settings reset to defaults");
  } catch (e) {
    log.error("Failed to reset settings", e);
    showToast("Failed to reset settings", true);
  }
};

qs<HTMLButtonElement>("btnAddEnv").onclick = () => {
  showEnvAddModal();
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
function switchTab(tab: "requests" | "settings" | "advanced" | "domains") {
  const requestsPage = document.getElementById("tab-requests");
  const settingsPage = document.getElementById("tab-settings");
  const advancedPage = document.getElementById("tab-advanced");
  const domainsPage = document.getElementById("tab-domains");
  const requestsToolbar = document.getElementById("toolbar-requests");
  const settingsToolbar = document.getElementById("toolbar-settings");
  const advancedToolbar = document.getElementById("toolbar-advanced");
  const domainsToolbar = document.getElementById("toolbar-domains");
  const settingsBtn = document.getElementById("btnSettings");
  const domainsBtn = document.getElementById("btnDomains");

  // Hide all
  requestsPage?.classList.remove("active");
  settingsPage?.classList.remove("active");
  advancedPage?.classList.remove("active");
  domainsPage?.classList.remove("active");
  requestsToolbar?.classList.add("hidden");
  settingsToolbar?.classList.add("hidden");
  advancedToolbar?.classList.add("hidden");
  domainsToolbar?.classList.add("hidden");
  settingsBtn?.classList.remove("active");
  domainsBtn?.classList.remove("active");

  // Show selected
  if (tab === "settings") {
    settingsPage?.classList.add("active");
    settingsToolbar?.classList.remove("hidden");
    settingsBtn?.classList.add("active");
  } else if (tab === "advanced") {
    advancedPage?.classList.add("active");
    advancedToolbar?.classList.remove("hidden");
    settingsBtn?.classList.add("active");
  } else if (tab === "domains") {
    domainsPage?.classList.add("active");
    domainsToolbar?.classList.remove("hidden");
    domainsBtn?.classList.add("active");
    // Refresh domains when switching to tab
    loadDomainState();
  } else {
    requestsPage?.classList.add("active");
    requestsToolbar?.classList.remove("hidden");
  }
}

qs<HTMLButtonElement>("btnSettings").onclick = () => switchTab("settings");
qs<HTMLButtonElement>("btnDomains").onclick = () => switchTab("domains");
qs<HTMLButtonElement>("btnBackToRequests").onclick = () => switchTab("requests");
qs<HTMLButtonElement>("btnBackFromDomains").onclick = () => switchTab("requests");
qs<HTMLButtonElement>("btnBackToSettings").onclick = () => switchTab("settings");
qs<HTMLElement>("advancedLink").onclick = () => switchTab("advanced");

// Domain toggle in header
const domainEnabledCheckbox = document.getElementById("domainEnabled") as HTMLInputElement | null;
if (domainEnabledCheckbox) {
  domainEnabledCheckbox.onchange = () => {
    if (currentDomain) {
      setDomainEnabled(currentDomain, domainEnabledCheckbox.checked);
    }
  };
}

const port = chrome.runtime.connect({ name: "FRANZAI_SIDEPANEL" });
port.onMessage.addListener(async (evt: BgEvent) => {
  if (evt.type === BG_EVT.LOGS_UPDATED || evt.type === BG_EVT.SETTINGS_UPDATED) {
    await loadAll();
  }
  if (evt.type === BG_EVT.DOMAIN_PREFS_UPDATED) {
    await loadDomainState();
  }
});

const refreshActiveTab = debounce(() => {
  loadDomainState();
}, 150);

chrome.tabs.onActivated.addListener(() => refreshActiveTab());
chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.url || changeInfo.status === "complete") {
    refreshActiveTab();
  }
});

/** Keyboard navigation */
document.addEventListener("keydown", (e) => {
  // Don't interfere with input fields
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
    // Escape blurs the input
    if (e.key === "Escape") {
      target.blur();
    }
    return;
  }

  // Escape closes detail pane
  if (e.key === "Escape" && selectedLogId) {
    closeDetailPane();
    return;
  }

  // j/k for navigation (like vim)
  if (e.key === "j" || e.key === "k" || e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const filteredLogs = filterLogs(logs);
    const sortedLogs = sortLogs(filteredLogs);
    if (!sortedLogs.length) return;

    const currentIndex = selectedLogId
      ? sortedLogs.findIndex(l => l.id === selectedLogId)
      : -1;

    let newIndex: number;
    if (e.key === "j" || e.key === "ArrowDown") {
      newIndex = currentIndex < sortedLogs.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : sortedLogs.length - 1;
    }

    const newLog = sortedLogs[newIndex];
    selectedLogId = newLog.id;
    renderDetails(newLog);

    // Update visual selection
    document.querySelectorAll(".item.active").forEach(el => el.classList.remove("active"));
    const items = logsList.querySelectorAll(".item");
    if (items[newIndex]) {
      items[newIndex].classList.add("active");
      items[newIndex].scrollIntoView({ block: "nearest" });
    }

    const detailPane = document.getElementById("detailPane");
    if (detailPane) detailPane.classList.add("visible");
    return;
  }

  // c to copy URL of selected request
  if (e.key === "c" && selectedLogId) {
    const log = logs.find(l => l.id === selectedLogId);
    if (log) {
      navigator.clipboard.writeText(log.url);
      showToast("URL copied to clipboard");
    }
    return;
  }

  // / to focus search
  if (e.key === "/") {
    e.preventDefault();
    const searchInput = document.getElementById("filterSearch") as HTMLInputElement;
    if (searchInput) searchInput.focus();
    return;
  }

  // r to refresh
  if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
    loadAll();
    return;
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
    saveUIPrefs(); // Persist sort preference
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
  saveUIPrefs(); // Persist column widths
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

/** Filter event handlers with debounce for text input */
const debouncedRenderLogs = debounce(() => renderLogs(), 150);

qs<HTMLInputElement>("filterSearch").oninput = (e) => {
  filterSearch = (e.target as HTMLInputElement).value;
  debouncedRenderLogs();
};

qs<HTMLSelectElement>("filterMethod").onchange = (e) => {
  filterMethod = (e.target as HTMLSelectElement).value;
  renderLogs();
};

qs<HTMLSelectElement>("filterStatus").onchange = (e) => {
  filterStatus = (e.target as HTMLSelectElement).value;
  renderLogs();
};

/** Clear filters button */
const clearFiltersBtn = document.getElementById("btnClearFilters");
if (clearFiltersBtn) {
  clearFiltersBtn.onclick = clearFilters;
}


/** Export logs as JSON */
qs<HTMLButtonElement>("btnExportLogs").onclick = () => {
  if (!logs.length) {
    showToast("No logs to export", true);
    return;
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: BRIDGE_VERSION,
    totalLogs: logs.length,
    logs: logs.map(l => ({
      id: l.id,
      ts: new Date(l.ts).toISOString(),
      method: l.method,
      url: l.url,
      status: l.status,
      statusText: l.statusText,
      elapsedMs: l.elapsedMs,
      error: l.error,
      requestHeaders: l.requestHeaders,
      requestBody: l.requestBodyPreview,
      responseHeaders: l.responseHeaders,
      responseBody: l.responseBodyPreview,
      pageOrigin: l.pageOrigin,
      tabId: l.tabId
    }))
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `franzai-bridge-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported ${logs.length} logs`);
};

// Initialize with UI preferences first, then load data
(async () => {
  await loadUIPrefs();
  applyColumnWidths();
  await loadAll();
  await loadDomainState();
})();
