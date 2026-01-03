import { BRIDGE_VERSION } from "../../shared/constants";
import { state } from "../state";
import { showToast } from "../ui/toast";

export function exportLogs(): void {
  if (!state.logs.length) {
    showToast("No logs to export", true);
    return;
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: BRIDGE_VERSION,
    totalLogs: state.logs.length,
    logs: state.logs.map((l) => ({
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
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `franzai-bridge-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  showToast(`Exported ${state.logs.length} logs`);
}
