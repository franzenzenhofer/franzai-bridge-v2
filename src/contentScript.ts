/**
 * Content Script (ISOLATED WORLD)
 *
 * This script runs in Chrome's isolated world and acts as a bridge between:
 * - The injected script (MAIN world) - communicates via postMessage
 * - The background service worker - communicates via chrome.runtime
 *
 * With manifest v3 and world: "MAIN", Chrome directly injects injected.js
 * into the page context. No manual script injection needed here.
 */

import type { BridgeStatus, FetchEnvelope, FetchRequestFromPage, FetchResponseToPage, PageFetchRequest } from "./shared/types";
import { BRIDGE_SOURCE, BRIDGE_TIMEOUT_MS } from "./shared/constants";
import { BG_EVT, BG_MSG, PAGE_MSG, type BgEvent, type PageToContentMessage } from "./shared/messages";
import { createLogger } from "./shared/logger";
import { sendRuntimeMessage } from "./shared/runtime";

const log = createLogger("content");

// =============================================================================
// Listen for domain preference changes from background
// =============================================================================

const port = chrome.runtime.connect({ name: "FRANZAI_CONTENT" });
port.onMessage.addListener(async (evt: BgEvent) => {
  if (evt.type === BG_EVT.DOMAIN_PREFS_UPDATED) {
    // Fetch updated status and notify the page
    const domain = window.location.hostname;
    try {
      const resp = await sendRuntimeMessage<
        { type: typeof BG_MSG.GET_DOMAIN_STATUS; payload: { domain: string } },
        { ok: boolean; status: BridgeStatus }
      >({
        type: BG_MSG.GET_DOMAIN_STATUS,
        payload: { domain }
      });

      if (resp.ok && resp.status) {
        log.info("Domain status updated, notifying page:", resp.status.domainEnabled);
        window.postMessage(
          {
            source: BRIDGE_SOURCE,
            type: PAGE_MSG.DOMAIN_ENABLED_UPDATE,
            payload: {
              enabled: resp.status.domainEnabled,
              source: resp.status.domainSource
            }
          },
          "*"
        );
      }
    } catch (e) {
      log.warn("Failed to fetch updated domain status", e);
    }
  }

  if (evt.type === BG_EVT.SETTINGS_UPDATED) {
    try {
      const resp = await sendRuntimeMessage<
        { type: typeof BG_MSG.GET_KEY_NAMES },
        { ok: boolean; keys: string[] }
      >({
        type: BG_MSG.GET_KEY_NAMES
      });

      if (resp.ok && Array.isArray(resp.keys)) {
        window.postMessage(
          {
            source: BRIDGE_SOURCE,
            type: PAGE_MSG.KEYS_UPDATE,
            payload: { keys: resp.keys }
          },
          "*"
        );
      }
    } catch (e) {
      log.warn("Failed to fetch updated key list", e);
    }
  }
});

// =============================================================================
// Meta Tag Detection
// =============================================================================

function detectMetaTag(): boolean {
  const meta = document.querySelector('meta[name="franzai-bridge"]');
  if (!meta) return false;
  const content = meta.getAttribute("content")?.toLowerCase();
  return content === "enabled" || content === "enabled-by-default" || content === "true";
}

function reportMetaTag() {
  const domain = window.location.hostname;
  const enabled = detectMetaTag();

  // Only report if meta tag is present and requests enabling
  if (enabled) {
    log.info("Meta tag detected, reporting to background:", domain);
    sendRuntimeMessage({
      type: BG_MSG.REPORT_META_TAG,
      payload: { domain, enabled: true }
    }).catch(e => log.warn("Failed to report meta tag", e));
  }
}

// Check meta tag when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", reportMetaTag);
} else {
  // DOM already ready
  reportMetaTag();
}

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;

  const data = event.data as PageToContentMessage | undefined;
  if (!data || data.source !== BRIDGE_SOURCE) return;

  if (data.type === PAGE_MSG.BRIDGE_READY) {
    log.info("Bridge ready", data.payload?.version);
    return;
  }

  if (data.type === PAGE_MSG.FETCH_ABORT) {
    const requestId = data.payload?.requestId;
    if (!requestId) return;

    try {
      await sendRuntimeMessage({
        type: BG_MSG.FETCH_ABORT,
        payload: { requestId }
      });
    } catch (e) {
      log.warn("Failed to forward abort", e);
    }

    return;
  }

  if (data.type === PAGE_MSG.KEY_CHECK_REQUEST) {
    const { checkId, keyName } = data.payload;
    if (!checkId || !keyName) return;

    try {
      const resp = await sendRuntimeMessage<
        { type: typeof BG_MSG.IS_KEY_SET; payload: { keyName: string } },
        { ok: boolean; isSet: boolean }
      >({
        type: BG_MSG.IS_KEY_SET,
        payload: { keyName }
      });

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.KEY_CHECK_RESPONSE,
          payload: { checkId, isSet: resp.isSet }
        },
        "*"
      );
    } catch (e) {
      log.warn("Failed to check key", e);
      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.KEY_CHECK_RESPONSE,
          payload: { checkId, isSet: false }
        },
        "*"
      );
    }
    return;
  }

  if (data.type === PAGE_MSG.KEYS_REQUEST) {
    const { keysId } = data.payload;
    if (!keysId) return;

    try {
      const resp = await sendRuntimeMessage<
        { type: typeof BG_MSG.GET_KEY_NAMES },
        { ok: boolean; keys: string[] }
      >({
        type: BG_MSG.GET_KEY_NAMES
      });

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.KEYS_RESPONSE,
          payload: { keysId, keys: resp.ok ? resp.keys : [] }
        },
        "*"
      );
    } catch (e) {
      log.warn("Failed to fetch key list", e);
      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.KEYS_RESPONSE,
          payload: { keysId, keys: [] }
        },
        "*"
      );
    }

    return;
  }

  if (data.type === PAGE_MSG.STATUS_REQUEST) {
    const { statusId } = data.payload;
    if (!statusId) return;

    const domain = window.location.hostname;

    try {
      const resp = await sendRuntimeMessage<
        { type: typeof BG_MSG.GET_DOMAIN_STATUS; payload: { domain: string } },
        { ok: boolean; status: BridgeStatus }
      >({
        type: BG_MSG.GET_DOMAIN_STATUS,
        payload: { domain }
      });

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.STATUS_RESPONSE,
          payload: { statusId, status: resp.status }
        },
        "*"
      );
    } catch (e) {
      log.warn("Failed to get status", e);
      const fallbackStatus: BridgeStatus = {
        installed: true,
        version: "unknown",
        domainEnabled: false,
        domainSource: "default",
        originAllowed: false,
        hasApiKeys: false,
        ready: false,
        reason: "Failed to get status from extension"
      };
      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.STATUS_RESPONSE,
          payload: { statusId, status: fallbackStatus }
        },
        "*"
      );
    }
    return;
  }

  if (data.type === PAGE_MSG.FETCH_REQUEST) {
    const req = data.payload as PageFetchRequest;
    if (!req?.requestId) {
      log.warn("Dropping request without requestId");
      return;
    }

    const payload: FetchRequestFromPage = {
      ...req,
      pageOrigin: window.location.origin
    };

    try {
      const resp = await sendRuntimeMessage<
        { type: typeof BG_MSG.FETCH; payload: FetchRequestFromPage },
        FetchEnvelope
      >({
        type: BG_MSG.FETCH,
        payload
      }, {
        timeoutMs: BRIDGE_TIMEOUT_MS + 5000
      });

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.FETCH_RESPONSE,
          payload: resp
        },
        "*"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorResponse: FetchResponseToPage = {
        requestId: req.requestId,
        ok: false,
        status: 0,
        statusText: "Bridge Error",
        headers: {},
        bodyText: "",
        elapsedMs: 0,
        error: message
      };

      log.error("Bridge error reaching background", message);

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.FETCH_RESPONSE,
          payload: {
            ok: false,
            response: errorResponse,
            error: `Failed to reach FranzAI Bridge background: ${message}`
          }
        },
        "*"
      );
    }
  }
});
