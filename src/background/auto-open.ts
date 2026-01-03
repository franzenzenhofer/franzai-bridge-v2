import { getDomainPreference } from "../shared/storage";
import { createLogger } from "../shared/logger";

const log = createLogger("auto-open");
const autoOpenedTabs = new Set<number>();

export async function maybeAutoOpenSidepanel(tabId: number | undefined): Promise<void> {
  if (!tabId) return;
  if (autoOpenedTabs.has(tabId)) return;

  autoOpenedTabs.add(tabId);
  try {
    log.info("Auto-opening sidepanel on first request for tab", tabId);
    await chrome.sidePanel.open({ tabId });
  } catch (e) {
    log.warn("Could not auto-open sidepanel", e);
  }
}

export function forgetAutoOpenedTab(tabId: number): void {
  autoOpenedTabs.delete(tabId);
}

export async function maybeAutoOpenOnUpdate(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) return;

  try {
    const url = new URL(tab.url);
    const pref = await getDomainPreference(url.hostname);
    if (pref?.enabled) await maybeAutoOpenSidepanel(tabId);
  } catch {
    // Ignore invalid URLs.
  }
}
