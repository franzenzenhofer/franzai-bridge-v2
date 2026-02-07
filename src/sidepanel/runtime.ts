import { BG_EVT, type BgEvent } from "../shared/messages";
import { debounce } from "./utils/debounce";
import { createLogger } from "../shared/logger";

const log = createLogger("sidepanel-runtime");
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 5000;

type RuntimeHandlers = {
  onRefresh: () => Promise<void> | void;
  onDomainPrefs: () => Promise<void> | void;
  onActiveTab: () => Promise<void> | void;
};

export function initRuntimeListeners(handlers: RuntimeHandlers): void {
  let port: chrome.runtime.Port | null = null;
  let reconnectDelayMs = RECONNECT_BASE_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const safeRun = async (fn: () => Promise<void> | void, label: string): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      log.warn(`Handler failed: ${label}`, error);
    }
  };

  const scheduleReconnect = (): void => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectPort();
    }, reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_MS);
  };

  const connectPort = (): void => {
    try {
      port = chrome.runtime.connect({ name: "FRANZAI_SIDEPANEL" });
    } catch (error) {
      log.warn("Failed to connect sidepanel runtime port", error);
      scheduleReconnect();
      return;
    }

    reconnectDelayMs = RECONNECT_BASE_MS;
    void safeRun(handlers.onRefresh, "onRefresh(connect)");

    port.onMessage.addListener((evt: BgEvent) => {
      if (evt.type === BG_EVT.LOGS_UPDATED || evt.type === BG_EVT.SETTINGS_UPDATED) {
        void safeRun(handlers.onRefresh, "onRefresh(event)");
      }
      if (evt.type === BG_EVT.DOMAIN_PREFS_UPDATED) {
        void safeRun(handlers.onDomainPrefs, "onDomainPrefs(event)");
      }
    });

    port.onDisconnect.addListener(() => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError?.message) {
        log.warn("Sidepanel runtime port disconnected", runtimeError.message);
      }
      port = null;
      scheduleReconnect();
    });
  };

  connectPort();

  const refreshActiveTab = debounce(() => {
    void safeRun(handlers.onActiveTab, "onActiveTab(tab-change)");
  }, 150);

  chrome.tabs.onActivated.addListener(() => refreshActiveTab());
  chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
    if (!tab.active) return;
    if (changeInfo.url || changeInfo.status === "complete") {
      refreshActiveTab();
    }
  });
}
