import { clearLogs } from "../data/settings";
import { showToast } from "../ui/toast";
import { exportHar, exportLogs } from "./export";

export function initLogActions(onRefresh: () => Promise<void> | void): void {
  const refreshBtn = document.getElementById("btnRefresh") as HTMLButtonElement | null;
  if (refreshBtn) {
    refreshBtn.onclick = () => onRefresh();
  }

  const clearBtn = document.getElementById("btnClearLogs") as HTMLButtonElement | null;
  if (clearBtn) {
    clearBtn.onclick = async () => {
      const resp = await clearLogs();
      if (resp.ok) {
        await onRefresh();
        showToast("Logs cleared");
      } else {
        showToast(resp.error ?? "Failed to clear logs", true);
      }
    };
  }

  const exportBtn = document.getElementById("btnExportLogs") as HTMLButtonElement | null;
  if (exportBtn) {
    exportBtn.onclick = () => exportLogs();
  }

  const exportHarBtn = document.getElementById("btnExportHar") as HTMLButtonElement | null;
  if (exportHarBtn) {
    exportHarBtn.onclick = () => exportHar();
  }
}
