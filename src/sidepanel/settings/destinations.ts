import { state } from "../state";
import { showToast } from "../ui/toast";
import { renderListTable } from "../ui/list-table";
import { updateSettings } from "./store";

export function renderDestinations(): void {
  renderListTable({
    tableId: "destsTable",
    items: state.settings?.allowedDestinations ?? [],
    emptyText: "No destinations allowed (everything blocked).",
    onDelete: async (value) => {
      if (!state.settings) return;
      const next = structuredClone(state.settings);
      next.allowedDestinations = next.allowedDestinations.filter((item) => item !== value);
      const resp = await updateSettings(next);
      if (resp.ok) showToast("Destination removed");
      else showToast(resp.error ?? "Failed to save settings", true);
    },
    onEdit: async (oldValue, newValue) => {
      if (!state.settings) return;
      const next = structuredClone(state.settings);
      const idx = next.allowedDestinations.indexOf(oldValue);
      if (idx >= 0) next.allowedDestinations[idx] = newValue;
      const resp = await updateSettings(next);
      if (resp.ok) showToast("Destination updated");
      else showToast(resp.error ?? "Failed to save settings", true);
    }
  });
}

export function initDestinations(): void {
  const addBtn = document.getElementById("btnAddDest") as HTMLButtonElement | null;
  const input = document.getElementById("destValue") as HTMLInputElement | null;
  if (!addBtn || !input) return;

  addBtn.onclick = async () => {
    if (!state.settings) return;
    const value = input.value.trim();
    if (!value) {
      input.focus();
      return;
    }

    const next = structuredClone(state.settings);
    if (!next.allowedDestinations.includes(value)) {
      next.allowedDestinations.push(value);
      input.value = "";
      const resp = await updateSettings(next);
      if (resp.ok) showToast("Destination added");
      else showToast(resp.error ?? "Failed to save settings", true);
    } else {
      showToast("Destination already exists", true);
    }
  };
}
