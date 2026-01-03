import { loadLogs, loadSettings } from "./data/settings";
import { renderLogs } from "./logs/render";
import { renderSettings } from "./settings/render";
import { state } from "./state";
import { showToast } from "./ui/toast";

export async function loadAll(): Promise<void> {
  const settings = await loadSettings();
  const logs = await loadLogs();

  if (!settings) {
    showToast("Failed to load settings", true);
  }
  if (!logs.length && state.logs.length === 0) {
    // Empty logs is valid; no toast needed.
  }

  renderLogs();
  renderSettings();

  if (state.selectedLogId && !state.logs.some((x) => x.id === state.selectedLogId)) {
    state.selectedLogId = null;
    const details = document.getElementById("details");
    if (details) details.innerHTML = '<div class="hint">Select a request to inspect.</div>';
  }
}
