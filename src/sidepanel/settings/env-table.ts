import type { BridgeSettings } from "../../shared/types";
import { getAliasKeys, normalizeKeyName, resolveKeyValue } from "../../shared/keys";
import { state } from "../state";
import { ICON_EDIT, ICON_TRASH } from "../ui/icons";
import { showToast } from "../ui/toast";
import { updateSettings } from "./store";
import { BUILTIN_KEY_TARGETS, getTargetDomain } from "./env-targets";
import { showEnvEditModal } from "./env-edit-modal";

function renderCard(key: string, value: string, settings: BridgeSettings): HTMLElement {
  const hasValue = value && value.trim() !== "";

  const targetDomain = getTargetDomain(key, settings);

  const card = document.createElement("div");
  card.className = "env-card" + (hasValue ? " has-value" : " no-value");

  const topRow = document.createElement("div");
  topRow.className = "env-card-top";

  const keyName = document.createElement("div");
  keyName.className = "env-card-key";
  keyName.textContent = key;

  const actions = document.createElement("div");
  actions.className = "env-card-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.innerHTML = ICON_EDIT;
  editBtn.title = hasValue ? "Edit" : "Set value";
  editBtn.onclick = () => showEnvEditModal(key, value || "");
  actions.appendChild(editBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "icon-btn";
  delBtn.innerHTML = ICON_TRASH;
  delBtn.title = "Delete";
  delBtn.onclick = async () => {
    const next = structuredClone(settings);
    const aliasKeys = getAliasKeys(key);
    for (const alias of aliasKeys) {
      delete next.env[alias];
    }
    const resp = await updateSettings(next);
    if (resp.ok) showToast(`Deleted ${key}`);
    else showToast(resp.error ?? "Failed to save settings", true);
  };
  actions.appendChild(delBtn);

  topRow.appendChild(keyName);
  topRow.appendChild(actions);

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
  return card;
}

export function renderEnvTable(): void {
  const envTable = document.getElementById("envTable");
  if (!envTable) return;
  envTable.innerHTML = "";

  const settings = state.settings;
  if (!settings) return;

  const keys = Array.from(new Set(Object.keys(settings.env ?? {}).map((key) => normalizeKeyName(key))))
    .sort((a, b) => a.localeCompare(b));
  if (!keys.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "No ENV vars configured.";
    envTable.appendChild(hint);
    return;
  }

  for (const key of keys) {
    const value = resolveKeyValue(settings.env, key);
    envTable.appendChild(renderCard(key, value, settings));
  }
}
