import { BG_EVT, type BgEvent } from "../shared/messages";
import { debounce } from "./utils/debounce";

type RuntimeHandlers = {
  onRefresh: () => Promise<void> | void;
  onDomainPrefs: () => Promise<void> | void;
  onActiveTab: () => Promise<void> | void;
};

export function initRuntimeListeners(handlers: RuntimeHandlers): void {
  const port = chrome.runtime.connect({ name: "FRANZAI_SIDEPANEL" });
  port.onMessage.addListener(async (evt: BgEvent) => {
    if (evt.type === BG_EVT.LOGS_UPDATED || evt.type === BG_EVT.SETTINGS_UPDATED) {
      await handlers.onRefresh();
    }
    if (evt.type === BG_EVT.DOMAIN_PREFS_UPDATED) {
      await handlers.onDomainPrefs();
    }
  });

  const refreshActiveTab = debounce(() => {
    handlers.onActiveTab();
  }, 150);

  chrome.tabs.onActivated.addListener(() => refreshActiveTab());
  chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
    if (!tab.active) return;
    if (changeInfo.url || changeInfo.status === "complete") {
      refreshActiveTab();
    }
  });
}
