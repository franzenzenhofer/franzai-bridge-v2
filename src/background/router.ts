import type { BridgeSettings, FetchRequestFromPage, GoogleFetchRequest } from "../shared/types";
import { BG_MSG, type BgEvent, type BgMessage } from "../shared/messages";
import { createLogger } from "../shared/logger";
import { handleFetch, abortFetch } from "./fetch";
import {
  handleGoogleAuth,
  handleGoogleLogout,
  handleGoogleGetState,
  handleGoogleHasScopes,
  handleGoogleFetch
} from "./googleHandlers";
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
} from "./settingsHandlers";

const log = createLogger("router");

type RouterContext = {
  broadcast: (evt: BgEvent) => void;
  maybeAutoOpenSidepanel: (tabId: number | undefined) => Promise<void>;
};

type MsgWithPayload = BgMessage & { payload?: unknown };

type Handler = (
  msg: MsgWithPayload,
  sender: chrome.runtime.MessageSender,
  ctx: RouterContext
) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  [BG_MSG.GET_SETTINGS]: async () => handleGetSettings(),
  [BG_MSG.SET_SETTINGS]: async (msg, _sender, ctx) =>
    handleSetSettings(msg.payload as BridgeSettings, ctx.broadcast),
  [BG_MSG.GET_LOGS]: async () => handleGetLogs(),
  [BG_MSG.CLEAR_LOGS]: async (_msg, _sender, ctx) =>
    handleClearLogs(ctx.broadcast),
  [BG_MSG.IS_KEY_SET]: async (msg) =>
    handleIsKeySet((msg.payload as { keyName?: string } | undefined)?.keyName ?? ""),
  [BG_MSG.GET_KEY_NAMES]: async () => handleGetKeyNames(),
  [BG_MSG.GET_DOMAIN_STATUS]: async (msg) =>
    handleGetDomainStatus((msg.payload as { domain?: string } | undefined)?.domain ?? ""),
  [BG_MSG.SET_DOMAIN_ENABLED]: async (msg, _sender, ctx) => {
    const payload = msg.payload as { domain?: string; enabled?: boolean } | undefined;
    return handleSetDomainEnabled(payload?.domain ?? "", payload?.enabled ?? false, ctx.broadcast);
  },
  [BG_MSG.GET_ALL_DOMAIN_PREFS]: async () => handleGetAllDomainPrefs(),
  [BG_MSG.REPORT_META_TAG]: async (msg, sender, ctx) => {
    const payload = msg.payload as { domain?: string; enabled?: boolean } | undefined;
    const result = await handleReportMetaTag(payload?.domain ?? "", payload?.enabled ?? false, ctx.broadcast);
    if (payload?.enabled && sender.tab?.id) {
      await ctx.maybeAutoOpenSidepanel(sender.tab.id);
    }
    return result;
  },
  [BG_MSG.REMOVE_DOMAIN_PREF]: async (msg, _sender, ctx) =>
    handleRemoveDomainPref((msg.payload as { domain?: string } | undefined)?.domain ?? "", ctx.broadcast),
  [BG_MSG.GOOGLE_AUTH]: async (msg, _sender, ctx) =>
    handleGoogleAuth((msg.payload as { scopes?: string[] } | undefined)?.scopes ?? [], ctx.broadcast),
  [BG_MSG.GOOGLE_LOGOUT]: async (_msg, _sender, ctx) => handleGoogleLogout(ctx.broadcast),
  [BG_MSG.GOOGLE_GET_STATE]: async () => handleGoogleGetState(),
  [BG_MSG.GOOGLE_HAS_SCOPES]: async (msg) =>
    handleGoogleHasScopes((msg.payload as { scopes?: string[] } | undefined)?.scopes ?? []),
  [BG_MSG.GOOGLE_FETCH]: async (msg) => handleGoogleFetch(msg.payload as GoogleFetchRequest)
};

export function registerMessageRouter(ctx: RouterContext): void {
  chrome.runtime.onMessage.addListener((msg: BgMessage, sender, sendResponse) => {
    (async () => {
      try {
        if (msg.type === BG_MSG.FETCH_ABORT) {
          if (msg.payload?.requestId) abortFetch(msg.payload.requestId);
          sendResponse({ ok: true });
          return;
        }

        if (msg.type === BG_MSG.FETCH) {
          const payload = msg.payload as FetchRequestFromPage;
          const tabId = sender.tab?.id;
          const result = await handleFetch(payload, tabId, ctx.broadcast);
          ctx.maybeAutoOpenSidepanel(tabId);
          sendResponse(result);
          return;
        }

        const handler = handlers[msg.type];
        if (!handler) {
          log.warn("Unknown message type", msg.type);
          sendResponse({ ok: false, error: "Unknown message type" });
          return;
        }

        const result = await handler(msg, sender, ctx);
        sendResponse(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log.error("Unhandled error in onMessage", e);
        sendResponse({ ok: false, error: `Internal error: ${message}` });
      }
    })();

    return true;
  });
}
