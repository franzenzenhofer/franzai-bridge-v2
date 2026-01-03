import { showToast } from "../ui/toast";

export function initResetSettings(onReset: () => Promise<void> | void): void {
  const resetBtn = document.getElementById("btnResetSettings") as HTMLButtonElement | null;
  if (!resetBtn) return;

  resetBtn.onclick = async () => {
    if (!confirm("Reset all settings to defaults? This will clear your API keys and custom rules.")) {
      return;
    }
    try {
      await chrome.storage.local.clear();
      await onReset();
      showToast("Settings reset to defaults");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Failed to reset settings: ${msg}`, true);
    }
  };
}
