import type { Dict, InjectionRule } from "../../shared/types";
import { state } from "../state";
import { escapeHtml } from "../utils/html";
import { ICON_TRASH } from "../ui/icons";
import { showToast } from "../ui/toast";
import { updateSettings } from "./store";

function parseJsonOrEmpty<T>(txt: string): T | undefined {
  if (!txt) return undefined;
  return JSON.parse(txt) as T;
}

export function renderRules(): void {
  const table = document.getElementById("rulesTable");
  if (!table) return;
  table.innerHTML = "";

  const items = state.settings?.injectionRules ?? [];
  if (!items.length) {
    table.innerHTML = '<div class="hint">No custom rules.</div>';
    return;
  }

  items.forEach((rule, idx) => {
    const row = document.createElement("div");
    row.className = "tr";

    const tdValue = document.createElement("div");
    tdValue.className = "td";
    tdValue.innerHTML = `
      <b>${escapeHtml(rule.hostPattern)}</b><br />
      <span style="color: var(--muted)">headers:</span> ${escapeHtml(JSON.stringify(rule.injectHeaders ?? {}))}<br />
      <span style="color: var(--muted)">query:</span> ${escapeHtml(JSON.stringify(rule.injectQuery ?? {}))}
    `;

    const tdActions = document.createElement("div");
    tdActions.className = "td actions";

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.innerHTML = ICON_TRASH;
    delBtn.title = "Delete rule";
    delBtn.onclick = async () => {
      if (!state.settings) return;
      const next = structuredClone(state.settings);
      next.injectionRules.splice(idx, 1);
      const resp = await updateSettings(next);
      if (resp.ok) showToast("Rule deleted");
      else showToast(resp.error ?? "Failed to save settings", true);
    };

    tdActions.appendChild(delBtn);
    row.appendChild(tdValue);
    row.appendChild(tdActions);
    table.appendChild(row);
  });
}

export function initRules(): void {
  const addBtn = document.getElementById("btnAddRule") as HTMLButtonElement | null;
  const hostInput = document.getElementById("ruleHost") as HTMLInputElement | null;
  const headersInput = document.getElementById("ruleHeaders") as HTMLTextAreaElement | null;
  const queryInput = document.getElementById("ruleQuery") as HTMLTextAreaElement | null;
  if (!addBtn || !hostInput || !headersInput || !queryInput) return;

  addBtn.onclick = async () => {
    if (!state.settings) return;

    const hostPattern = hostInput.value.trim();
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
      injectHeaders = parseJsonOrEmpty<Dict<string>>(headersInput.value.trim());
      injectQuery = parseJsonOrEmpty<Dict<string>>(queryInput.value.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Invalid JSON: ${msg}`, true);
      return;
    }

    const rule: InjectionRule = { hostPattern, injectHeaders, injectQuery };
    const next = structuredClone(state.settings);
    next.injectionRules.push(rule);

    hostInput.value = "";
    headersInput.value = "";
    queryInput.value = "";

    const resp = await updateSettings(next);
    if (resp.ok) showToast("Rule added");
    else showToast(resp.error ?? "Failed to save settings", true);
  };
}
