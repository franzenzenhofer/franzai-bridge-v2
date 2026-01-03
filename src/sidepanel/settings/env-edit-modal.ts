import { state } from "../state";
import { showToast } from "../ui/toast";
import { updateSettings } from "./store";
import { BUILTIN_KEY_TARGETS, getTargetDomain } from "./env-targets";

export function showEnvEditModal(key: string, currentValue: string): void {
  const settings = state.settings;
  if (!settings) return;

  const isBuiltin = key in BUILTIN_KEY_TARGETS;
  const targetDomain = getTargetDomain(key, settings);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal env-edit-modal";

  const title = document.createElement("div");
  title.className = "modal-title";
  title.textContent = `Edit ${key}`;

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

  const valueRow = document.createElement("div");
  valueRow.className = "modal-field";
  const valueLabel = document.createElement("label");
  valueLabel.textContent = "Value";
  const input = document.createElement("input");
  input.type = "password";
  input.value = currentValue;
  input.placeholder = "Enter API key or secret";
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
    const next = structuredClone(settings);
    next.env[key] = input.value;
    const resp = await updateSettings(next);
    overlay.remove();
    if (resp.ok) showToast(`Updated ${key}`);
    else showToast(resp.error ?? "Failed to save settings", true);
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

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    if (e.key === "Enter") saveBtn.click();
  };
  document.addEventListener("keydown", onKey);

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}
