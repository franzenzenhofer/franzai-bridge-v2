// Background Service Worker - Main Entry Point

import type { FetchRequestFromPage, GoogleFetchRequest } from "./shared/types";
import { BG_EVT, BG_MSG, type BgEvent, type BgMessage } from "./shared/messages";
import { getSettings, setSettings, getDomainPreference } from "./shared/storage";
import { createLogger } from "./shared/logger";

// Modular handlers
import { handleFetch, abortFetch } from "./background/fetchHandler";
import {
  handleGoogleAuth,
  handleGoogleLogout,
  handleGoogleGetState,
  handleGoogleHasScopes,
  handleGoogleFetch
} from "./background/googleHandlers";
import {
  handleGetSettings,
  handleSetSettings,
  handleGetLogs,
  handleClearLogs,
  handleIsKeySet,
  handleGetKeyNames,
  handleGetDomainStatus,
  handleSetDomainEnabled,
  handleGetAllDomainPrefs,
  handleReportMetaTag,
  handleRemoveDomainPref
} from "./background/settingsHandlers";

const log = createLogger("bg");

// =============================================================================
// Port Management for Broadcasting
// =============================================================================

const ports = new Set<chrome.runtime.Port>();
const autoOpenedTabs = new Set<number>();

function broadcast(evt: BgEvent) {
  for (const port of ports) {
    try {
      port.postMessage(evt);
    } catch {
      // Ignore dead ports
    }
  }
}

// =============================================================================
// Sidepanel Auto-Open
// =============================================================================

async function maybeAutoOpenSidepanel(tabId: number | undefined) {
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

// =============================================================================
// Lifecycle Listeners
// =============================================================================

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
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
});

chrome.action.onClicked.addListener(async (tab) => {
  log.info("Extension icon clicked, opening sidepanel for tab", tab.id);
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (e) {
      log.error("Failed to open sidepanel", e);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  autoOpenedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) return;

  try {
    const url = new URL(tab.url);
    const domain = url.hostname;
    const pref = await getDomainPreference(domain);

    if (pref?.enabled) {
      maybeAutoOpenSidepanel(tabId);
    }
  } catch {
    // Invalid URL, ignore
  }
});

// =============================================================================
// Message Handler
// =============================================================================

chrome.runtime.onMessage.addListener((msg: BgMessage, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case BG_MSG.GET_SETTINGS:
          sendResponse(await handleGetSettings());
          return;

        case BG_MSG.SET_SETTINGS:
          sendResponse(await handleSetSettings(msg.payload, broadcast));
          return;

        case BG_MSG.GET_LOGS:
          sendResponse(await handleGetLogs());
          return;

        case BG_MSG.CLEAR_LOGS:
          sendResponse(await handleClearLogs(broadcast));
          return;

        case BG_MSG.FETCH_ABORT:
          if (msg.payload?.requestId) abortFetch(msg.payload.requestId);
          sendResponse({ ok: true });
          return;

        case BG_MSG.IS_KEY_SET:
          sendResponse(await handleIsKeySet(msg.payload?.keyName ?? ""));
          return;

        case BG_MSG.GET_KEY_NAMES:
          sendResponse(await handleGetKeyNames());
          return;

        case BG_MSG.GET_DOMAIN_STATUS:
          sendResponse(await handleGetDomainStatus(msg.payload?.domain ?? ""));
          return;

        case BG_MSG.SET_DOMAIN_ENABLED: {
          const { domain, enabled } = msg.payload ?? {};
          sendResponse(await handleSetDomainEnabled(domain ?? "", enabled ?? false, broadcast));
          return;
        }

        case BG_MSG.GET_ALL_DOMAIN_PREFS:
          sendResponse(await handleGetAllDomainPrefs());
          return;

        case BG_MSG.REPORT_META_TAG: {
          const { domain, enabled } = msg.payload ?? {};
          const result = await handleReportMetaTag(domain ?? "", enabled ?? false, broadcast);
          if (enabled && sender.tab?.id) {
            maybeAutoOpenSidepanel(sender.tab.id);
          }
          sendResponse(result);
          return;
        }

        case BG_MSG.REMOVE_DOMAIN_PREF:
          sendResponse(await handleRemoveDomainPref(msg.payload?.domain ?? "", broadcast));
          return;

        case BG_MSG.GOOGLE_AUTH:
          sendResponse(await handleGoogleAuth(msg.payload?.scopes ?? [], broadcast));
          return;

        case BG_MSG.GOOGLE_LOGOUT:
          sendResponse(await handleGoogleLogout(broadcast));
          return;

        case BG_MSG.GOOGLE_GET_STATE:
          sendResponse(await handleGoogleGetState());
          return;

        case BG_MSG.GOOGLE_HAS_SCOPES:
          sendResponse(await handleGoogleHasScopes(msg.payload?.scopes ?? []));
          return;

        case BG_MSG.GOOGLE_FETCH:
          sendResponse(await handleGoogleFetch(msg.payload as GoogleFetchRequest));
          return;

        case BG_MSG.FETCH: {
          const payload = msg.payload as FetchRequestFromPage;
          const tabId = sender.tab?.id;
          const result = await handleFetch(payload, tabId, broadcast);
          maybeAutoOpenSidepanel(tabId);
          sendResponse(result);
          return;
        }

        default: {
          const unknown = (msg as { type: string }).type;
          log.warn("Unknown message type", unknown);
          sendResponse({ ok: false, error: "Unknown message type" });
          return;
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.error("Unhandled error in onMessage", e);
      sendResponse({ ok: false, error: `Internal error: ${message}` });
    }
  })();

  return true;
});
