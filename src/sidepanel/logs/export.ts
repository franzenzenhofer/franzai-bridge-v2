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

export function exportHar(): void {
  if (!state.logs.length) {
    showToast("No logs to export", true);
    return;
  }

  const har = {
    log: {
      version: "1.2",
      creator: { name: "FranzAI Bridge", version: BRIDGE_VERSION },
      entries: state.logs.map((log) => {
        const url = log.url;
        const queryString = extractQueryString(url);
        const requestHeaders = headersToHar(log.requestHeaders);
        const responseHeaders = headersToHar(log.responseHeaders ?? {});
        const responseBody = log.responseBodyPreview ?? "";
        const requestBody = log.requestBodyPreview ?? "";
        const contentType = log.responseHeaders?.["content-type"] ?? "text/plain";

        return {
          startedDateTime: new Date(log.ts).toISOString(),
          time: log.elapsedMs ?? 0,
          request: {
            method: log.method,
            url,
            httpVersion: "HTTP/1.1",
            headers: requestHeaders,
            queryString,
            headersSize: -1,
            bodySize: requestBody.length,
            postData: requestBody
              ? { mimeType: log.requestHeaders?.["content-type"] ?? "text/plain", text: requestBody }
              : undefined
          },
          response: {
            status: log.status ?? 0,
            statusText: log.statusText ?? "",
            httpVersion: "HTTP/1.1",
            headers: responseHeaders,
            content: {
              size: responseBody.length,
              mimeType: contentType,
              text: responseBody
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: responseBody.length
          },
          cache: {},
          timings: { send: 0, wait: 0, receive: log.elapsedMs ?? 0 }
        };
      })
    }
  };

  const blob = new Blob([JSON.stringify(har, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `franzai-bridge-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.har`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  showToast(`Exported ${state.logs.length} logs (HAR)`);
}

function headersToHar(headers: Record<string, string> | undefined): { name: string; value: string }[] {
  if (!headers) return [];
  return Object.entries(headers).map(([name, value]) => ({ name, value }));
}

function extractQueryString(url: string): { name: string; value: string }[] {
  try {
    const parsed = new URL(url);
    const entries: { name: string; value: string }[] = [];
    parsed.searchParams.forEach((value, name) => entries.push({ name, value }));
    return entries;
  } catch {
    return [];
  }
}
