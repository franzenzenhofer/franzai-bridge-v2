import { createLogger } from "../shared/logger";
import { getSettings, setSettings } from "../shared/storage";
import { maybeAutoOpenOnUpdate, forgetAutoOpenedTab } from "./auto-open";
import type { PortHub } from "./ports";

const log = createLogger("lifecycle");

export function registerLifecycleHandlers(portHub: PortHub): void {
  chrome.runtime.onInstalled.addListener(async (details) => {
    log.info("Extension installed/updated:", details.reason);

    try {
      const settings = await getSettings();
      await setSettings(settings);
    } catch (e) {
      log.error("onInstalled failed", e);
    }

    await chrome.sidePanel.setOptions({ enabled: true });

    if (details.reason === "install") {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          log.info("Opening sidepanel after install for tab", tab.id);
          await chrome.sidePanel.open({ tabId: tab.id });
        }
      } catch (e) {
        log.warn("Could not auto-open sidepanel after install", e);
      }
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "FRANZAI_SIDEPANEL" && port.name !== "FRANZAI_CONTENT") return;
    portHub.register(port);
  });

  chrome.action.onClicked.addListener(async (tab) => {
    log.info("Extension icon clicked, opening sidepanel for tab", tab.id);
    if (!tab.id) return;
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (e) {
      log.error("Failed to open sidepanel", e);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    forgetAutoOpenedTab(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    void maybeAutoOpenOnUpdate(tabId, changeInfo, tab);
  });
}
