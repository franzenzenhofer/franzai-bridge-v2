import type {
  BridgeSettings,
  Dict,
  FetchEnvelope,
  FetchRequestFromPage,
  FetchResponseToPage,
  InjectionRule,
  LogEntry
} from "./shared/types";
import { BG_EVT, BG_MSG, type BgEvent, type BgMessage } from "./shared/messages";
import {
  getSettings,
  setSettings,
  appendLog,
  getLogs,
  clearLogs,
  getDomainPreference,
  getDomainPreferences,
  setDomainPreference,
  removeDomainPreference
} from "./shared/storage";
import type { BridgeStatus } from "./shared/types";
import { matchesAnyPattern, wildcardToRegExp } from "./shared/wildcard";
import { builtinProviderRules, expandTemplate, headersToObject, hasHeader } from "./shared/providers";
import {
  BRIDGE_VERSION,
  FETCH_TIMEOUT_MS,
  REQUEST_BODY_PREVIEW_LIMIT,
  RESPONSE_BODY_PREVIEW_LIMIT
} from "./shared/constants";
import { createLogger } from "./shared/logger";
import { makeId } from "./shared/ids";

const log = createLogger("bg");

const ports = new Set<chrome.runtime.Port>();
const inFlight = new Map<string, AbortController>();
const abortedByPage = new Set<string>();

// Track tabs where we've already auto-opened the sidepanel
const autoOpenedTabs = new Set<number>();

async function maybeAutoOpenSidepanel(tabId: number | undefined) {
  if (!tabId) return;
  if (autoOpenedTabs.has(tabId)) return;

  // Mark as opened so we only do this once per tab
  autoOpenedTabs.add(tabId);

  try {
    log.info("Auto-opening sidepanel on first request for tab", tabId);
    await chrome.sidePanel.open({ tabId });
  } catch (e) {
    log.warn("Could not auto-open sidepanel", e);
  }
}

function broadcast(evt: BgEvent) {
  for (const port of ports) {
    try {
      port.postMessage(evt);
    } catch {
      // Ignore dead ports.
    }
  }
}

function isDestinationAllowed(url: URL, allowedDestinations: string[]): boolean {
  const full = url.toString();
  const host = url.hostname;

  for (const pat of allowedDestinations) {
    const p = pat.trim();
    if (!p) continue;

    if (p.includes("://")) {
      if (wildcardToRegExp(p).test(full)) return true;
    } else {
      if (wildcardToRegExp(p).test(host)) return true;
    }
  }

  return false;
}

function applyInjectionRules(args: {
  url: URL;
  headers: Dict<string>;
  env: Dict<string>;
  rules: InjectionRule[];
}) {
  const { url, headers, env, rules } = args;

  for (const rule of rules) {
    const hostRe = wildcardToRegExp(rule.hostPattern);
    if (!hostRe.test(url.hostname)) continue;

    if (rule.injectHeaders) {
      for (const [hk, hvTemplate] of Object.entries(rule.injectHeaders)) {
        if (hasHeader(headers, hk)) continue;
        const value = expandTemplate(hvTemplate, env).trim();
        if (value) headers[hk] = value;
      }
    }

    if (rule.injectQuery) {
      for (const [qk, qvTemplate] of Object.entries(rule.injectQuery)) {
        if (url.searchParams.has(qk)) continue;
        const value = expandTemplate(qvTemplate, env).trim();
        if (value) url.searchParams.set(qk, value);
      }
    }
  }
}

function previewBody(body: unknown, max: number): string {
  if (body == null) return "";
  if (body instanceof Uint8Array) return `[binary body ${body.byteLength} bytes]`;
  if (body instanceof ArrayBuffer) return `[binary body ${body.byteLength} bytes]`;
  if (typeof body !== "string") return `[${typeof body} body omitted]`;
  if (body.length <= max) return body;
  return body.slice(0, max) + `\n\n...[truncated, total ${body.length} chars]`;
}

function makeErrorResponse(
  requestId: string,
  statusText: string,
  message: string,
  elapsedMs: number
): FetchResponseToPage {
  return {
    requestId,
    ok: false,
    status: 0,
    statusText,
    headers: {},
    bodyText: "",
    elapsedMs,
    error: message
  };
}

async function finalizeWithError(args: {
  requestId: string;
  statusText: string;
  message: string;
  started: number;
  logEntry: LogEntry;
  maxLogs: number;
}): Promise<FetchEnvelope> {
  const { requestId, statusText, message, started, logEntry, maxLogs } = args;
  const elapsedMs = Date.now() - started;
  logEntry.status = 0;
  logEntry.statusText = statusText;
  logEntry.error = message;
  logEntry.elapsedMs = elapsedMs;

  await appendLog(logEntry, maxLogs);
  broadcast({ type: BG_EVT.LOGS_UPDATED });

  const response = makeErrorResponse(requestId, statusText, message, elapsedMs);
  return { ok: false, response, error: message };
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    log.info("onInstalled: ensuring settings in storage");
    const settings = await getSettings();
    await setSettings(settings);
  } catch (e) {
    log.error("onInstalled failed", e);
  }
});

chrome.runtime.onConnect.addListener((port) => {
  // Accept both sidepanel AND content script ports for broadcasting
  if (port.name !== "FRANZAI_SIDEPANEL" && port.name !== "FRANZAI_CONTENT") return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
});

chrome.runtime.onMessage.addListener((msg: BgMessage, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case BG_MSG.GET_SETTINGS: {
          const settings = await getSettings();
          sendResponse({ ok: true, settings });
          return;
        }
        case BG_MSG.SET_SETTINGS: {
          await setSettings(msg.payload);
          broadcast({ type: BG_EVT.SETTINGS_UPDATED });
          sendResponse({ ok: true });
          return;
        }
        case BG_MSG.GET_LOGS: {
          const logs = await getLogs();
          sendResponse({ ok: true, logs });
          return;
        }
        case BG_MSG.CLEAR_LOGS: {
          await clearLogs();
          broadcast({ type: BG_EVT.LOGS_UPDATED });
          sendResponse({ ok: true });
          return;
        }
        case BG_MSG.FETCH_ABORT: {
          const requestId = msg.payload?.requestId;
          if (requestId) {
            abortedByPage.add(requestId);
            const controller = inFlight.get(requestId);
            if (controller) controller.abort();
          }
          sendResponse({ ok: true });
          return;
        }
        case BG_MSG.IS_KEY_SET: {
          const settings = await getSettings();
          const keyName = msg.payload?.keyName;
          // Check if the key exists and has a non-empty value
          const isSet = !!(keyName && settings.env[keyName]?.trim());
          // NEVER return the actual key value - only boolean
          sendResponse({ ok: true, isSet });
          return;
        }
        case BG_MSG.GET_DOMAIN_STATUS: {
          const domain = msg.payload?.domain;
          if (!domain) {
            sendResponse({ ok: false, error: "No domain provided" });
            return;
          }
          const settings = await getSettings();
          const pref = await getDomainPreference(domain);

          // Check if any API keys are configured
          const hasApiKeys = Object.values(settings.env).some(v => v?.trim());

          // Determine enabled status: user pref > meta pref > default (off)
          let domainEnabled = false;
          let domainSource: "user" | "meta" | "default" = "default";

          if (pref) {
            domainEnabled = pref.enabled;
            domainSource = pref.source;
          }

          // All origins are allowed - domain control is handled via per-domain enable/disable
          const originAllowed = true;

          const ready = domainEnabled && originAllowed;
          let reason = "";
          if (!domainEnabled) {
            reason = domainSource === "default"
              ? "Bridge is disabled for this domain. Enable it in the extension or add <meta name=\"franzai-bridge\" content=\"enabled\"> to your page."
              : "Bridge was disabled by user for this domain.";
          } else if (!hasApiKeys) {
            reason = "No API keys configured. Add keys in extension settings.";
          } else {
            reason = "Bridge is ready.";
          }

          const status: BridgeStatus = {
            installed: true,
            version: BRIDGE_VERSION,
            domainEnabled,
            domainSource,
            originAllowed,
            hasApiKeys,
            ready,
            reason
          };

          sendResponse({ ok: true, status });
          return;
        }
        case BG_MSG.SET_DOMAIN_ENABLED: {
          const { domain, enabled } = msg.payload ?? {};
          if (!domain) {
            sendResponse({ ok: false, error: "No domain provided" });
            return;
          }
          await setDomainPreference(domain, enabled, "user");
          broadcast({ type: BG_EVT.DOMAIN_PREFS_UPDATED });
          sendResponse({ ok: true });
          return;
        }
        case BG_MSG.GET_ALL_DOMAIN_PREFS: {
          const prefs = await getDomainPreferences();
          sendResponse({ ok: true, prefs });
          return;
        }
        case BG_MSG.REPORT_META_TAG: {
          const { domain, enabled } = msg.payload ?? {};
          if (!domain) {
            sendResponse({ ok: false, error: "No domain provided" });
            return;
          }
          // Only set if no user preference exists (meta tag is lower priority)
          await setDomainPreference(domain, enabled, "meta");
          broadcast({ type: BG_EVT.DOMAIN_PREFS_UPDATED });

          // Auto-open sidepanel when meta tag enables the domain
          if (enabled && sender.tab?.id) {
            maybeAutoOpenSidepanel(sender.tab.id);
          }

          sendResponse({ ok: true });
          return;
        }
        case BG_MSG.REMOVE_DOMAIN_PREF: {
          const { domain } = msg.payload ?? {};
          if (!domain) {
            sendResponse({ ok: false, error: "No domain provided" });
            return;
          }
          await removeDomainPreference(domain);
          broadcast({ type: BG_EVT.DOMAIN_PREFS_UPDATED });
          sendResponse({ ok: true });
          return;
        }
        case BG_MSG.FETCH: {
          const settings = await getSettings();
          const payload = msg.payload as FetchRequestFromPage;
          const tabId = sender.tab?.id;
          const started = Date.now();

          log.info("FRANZAI_FETCH", {
            requestId: payload.requestId,
            tabId,
            pageOrigin: payload.pageOrigin,
            url: payload.url
          });

          const init = payload.init ?? {};
          const method = (init.method ?? "GET").toUpperCase();
          const requestHeaders = headersToObject(init.headers);

          const logEntry: LogEntry = {
            id: makeId("log"),
            requestId: payload.requestId,
            ts: Date.now(),
            tabId,
            pageOrigin: payload.pageOrigin,
            url: payload.url,
            method,
            requestHeaders,
            requestBodyPreview: previewBody(init.body, REQUEST_BODY_PREVIEW_LIMIT)
          };

          // Always allow all page origins - domain control is handled via per-domain enable/disable
          if (!payload.pageOrigin) {
            const env = await finalizeWithError({
              requestId: payload.requestId,
              statusText: "Blocked",
              message: `Blocked: no page origin provided.`,
              started,
              logEntry,
              maxLogs: settings.maxLogs
            });
            log.warn("Blocked fetch: no origin provided");
            sendResponse(env);
            return;
          }

          let url: URL;
          try {
            url = new URL(payload.url);
          } catch {
            const env = await finalizeWithError({
              requestId: payload.requestId,
              statusText: "Bad URL",
              message: `Invalid URL: ${payload.url}`,
              started,
              logEntry,
              maxLogs: settings.maxLogs
            });
            log.warn("Blocked fetch: invalid URL", payload.url);
            sendResponse(env);
            return;
          }

          logEntry.url = url.toString();

          if (!isDestinationAllowed(url, settings.allowedDestinations)) {
            const env = await finalizeWithError({
              requestId: payload.requestId,
              statusText: "Blocked",
              message: `Blocked: destination not allowed (${url.hostname}).`,
              started,
              logEntry,
              maxLogs: settings.maxLogs
            });
            log.warn("Blocked fetch: destination not allowed", url.hostname);
            sendResponse(env);
            return;
          }

          const allRules = [...builtinProviderRules(), ...settings.injectionRules];
          applyInjectionRules({
            url,
            headers: requestHeaders,
            env: settings.env,
            rules: allRules
          });

          const fetchInit: RequestInit = {
            method,
            headers: requestHeaders,
            body: init.body as BodyInit | undefined,
            redirect: init.redirect,
            credentials: init.credentials,
            cache: init.cache,
            referrer: init.referrer,
            referrerPolicy: init.referrerPolicy,
            integrity: init.integrity,
            keepalive: init.keepalive
          };

          const controller = new AbortController();
          let timedOut = false;
          const timeoutId = setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, FETCH_TIMEOUT_MS);

          inFlight.set(payload.requestId, controller);

          try {
            const res = await fetch(url.toString(), { ...fetchInit, signal: controller.signal });
            const headersObj: Dict<string> = {};
            res.headers.forEach((value, key) => {
              headersObj[key] = value;
            });

            const bodyText = await res.text();
            const elapsedMs = Date.now() - started;

            logEntry.status = res.status;
            logEntry.statusText = res.statusText;
            logEntry.responseHeaders = headersObj;
            logEntry.responseBodyPreview = previewBody(bodyText, RESPONSE_BODY_PREVIEW_LIMIT);
            logEntry.elapsedMs = elapsedMs;

            await appendLog(logEntry, settings.maxLogs);
            broadcast({ type: BG_EVT.LOGS_UPDATED });

            const responseToPage: FetchResponseToPage = {
              requestId: payload.requestId,
              ok: res.ok,
              status: res.status,
              statusText: res.statusText,
              headers: headersObj,
              bodyText,
              elapsedMs
            };

            log.info("Fetch completed", {
              requestId: payload.requestId,
              url: url.toString(),
              status: res.status,
              elapsedMs
            });

            // Auto-open sidepanel on first request from this tab
            maybeAutoOpenSidepanel(tabId);

            sendResponse({ ok: true, response: responseToPage });
            return;
          } catch (e) {
            const elapsedMs = Date.now() - started;
            const err = e instanceof Error ? e.message : String(e);
            const isAbort = e instanceof Error && e.name === "AbortError";

            let message = err;
            let statusText = "Network Error";
            if (isAbort && timedOut) {
              statusText = "Timeout";
              message = `Timed out after ${FETCH_TIMEOUT_MS}ms`;
            } else if (isAbort && abortedByPage.has(payload.requestId)) {
              statusText = "Aborted";
              message = "Aborted by caller";
            }

            logEntry.error = message;
            logEntry.statusText = statusText;
            logEntry.elapsedMs = elapsedMs;

            await appendLog(logEntry, settings.maxLogs);
            broadcast({ type: BG_EVT.LOGS_UPDATED });

            const responseToPage: FetchResponseToPage = {
              requestId: payload.requestId,
              ok: false,
              status: 0,
              statusText,
              headers: {},
              bodyText: "",
              elapsedMs,
              error: message
            };

            log.error("Fetch failed", { requestId: payload.requestId, statusText, message });

            sendResponse({ ok: false, response: responseToPage, error: message });
            return;
          } finally {
            clearTimeout(timeoutId);
            inFlight.delete(payload.requestId);
            abortedByPage.delete(payload.requestId);
          }
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

// Open sidepanel when clicking the extension action icon
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

// Clean up auto-opened tracking when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  autoOpenedTabs.delete(tabId);
});

// Auto-open sidepanel when navigating to an enabled domain
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only trigger on complete navigation with a URL
  if (changeInfo.status !== "complete" || !tab.url) return;

  // Skip non-http(s) URLs
  if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) return;

  try {
    const url = new URL(tab.url);
    const domain = url.hostname;
    const pref = await getDomainPreference(domain);

    // Only auto-open if domain is enabled (user or meta)
    if (pref?.enabled) {
      maybeAutoOpenSidepanel(tabId);
    }
  } catch {
    // Invalid URL, ignore
  }
});

// Open sidepanel on install
chrome.runtime.onInstalled.addListener(async (details) => {
  log.info("Extension installed/updated:", details.reason);

  // Enable sidepanel for all tabs
  await chrome.sidePanel.setOptions({
    enabled: true
  });

  // Try to open sidepanel in the current active tab
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
