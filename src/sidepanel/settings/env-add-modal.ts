import type { InjectionRule } from "../../shared/types";
import { state } from "../state";
import { showToast } from "../ui/toast";
import { updateSettings } from "./store";
import { getAliasKeys, normalizeKeyName } from "../../shared/keys";

export function showEnvAddModal(): void {
  const settings = state.settings;
  if (!settings) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal env-edit-modal";

  const title = document.createElement("div");
  title.className = "modal-title";
  title.textContent = "Add ENV Variable";

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
    const name = normalizeKeyName(nameInput.value.trim());
    const target = targetInput.value.trim().toLowerCase();
    const value = valueInput.value;

    if (!name) {
      nameInput.classList.add("error");
      nameInput.focus();
      showToast("Name is required", true);
      setTimeout(() => nameInput.classList.remove("error"), 2000);
      return;
    }

    if (!target) {
      targetInput.classList.add("error");
      targetInput.focus();
      showToast("Target domain is required", true);
      setTimeout(() => targetInput.classList.remove("error"), 2000);
      return;
    }

    const next = structuredClone(settings);
    const aliasKeys = getAliasKeys(name);
    for (const alias of aliasKeys) {
      delete next.env[alias];
    }
    next.env[name] = value;

    const newRule: InjectionRule = {
      hostPattern: target,
      injectHeaders: { Authorization: `Bearer \${${name}}` }
    };

    const existingRuleIdx = next.injectionRules.findIndex((r: InjectionRule) => {
      if (r.hostPattern !== target) return false;
      if (!r.injectHeaders) return false;
      return Object.values(r.injectHeaders).some((v) => v.includes(`\${${name}}`));
    });

    if (existingRuleIdx === -1) {
      next.injectionRules.push(newRule);
    }

    const resp = await updateSettings(next);
    overlay.remove();
    if (resp.ok) showToast(`Added ${name} → ${target}`);
    else showToast(resp.error ?? "Failed to save settings", true);
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

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}
