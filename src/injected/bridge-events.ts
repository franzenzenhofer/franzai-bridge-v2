import { BRIDGE_SOURCE } from "../shared/constants";
import { PAGE_MSG } from "../shared/messages";
import { createLogger } from "../shared/logger";
import { applyDomainUpdate } from "./domain-status";
import { updateKeyCache } from "./keys";
import { updateGoogleAuthState } from "./google-state";

const log = createLogger("page-events");

export function registerBridgeEventListeners(syncBridgeHooksFromCache: () => void): void {
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const data = ev.data as { source?: string; type?: string; payload?: { enabled?: boolean; source?: string } };
    if (!data || data.source !== BRIDGE_SOURCE) return;
    if (data.type !== PAGE_MSG.DOMAIN_ENABLED_UPDATE) return;

    const enabled = data.payload?.enabled ?? false;
    log.info("DOMAIN_ENABLED_UPDATE received:", enabled);
    applyDomainUpdate(data.payload ?? {});
    syncBridgeHooksFromCache();
  });

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const data = ev.data as { source?: string; type?: string; payload?: { keys?: string[] } };
    if (!data || data.source !== BRIDGE_SOURCE) return;
    if (data.type !== PAGE_MSG.KEYS_UPDATE) return;

    if (Array.isArray(data.payload?.keys)) {
      updateKeyCache(data.payload.keys);
    }
  });

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const data = ev.data as { source?: string; type?: string; payload?: { authenticated: boolean; email: string | null; scopes: string[] } };
    if (!data || data.source !== BRIDGE_SOURCE) return;
    if (data.type !== PAGE_MSG.GOOGLE_AUTH_UPDATE) return;

    if (data.payload) {
      updateGoogleAuthState(data.payload);
      log.info("Google auth state updated:", data.payload.authenticated, data.payload.email);
    }
  });
}
