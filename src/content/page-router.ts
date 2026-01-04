import { PAGE_MSG, type PageToContentMessage } from "../shared/messages";
import { BRIDGE_SOURCE } from "../shared/constants";
import { createLogger } from "../shared/logger";
import { handleFetchAbort, handleFetchRequest } from "./handlers/fetch";
import { handleKeyCheck } from "./handlers/key-check";
import { handleKeysRequest } from "./handlers/keys";
import { handleStatusRequest } from "./handlers/status";
import { handleStreamAbort, handleStreamRequest } from "./handlers/stream";
import {
  handleGoogleAuth,
  handleGoogleLogout,
  handleGoogleState,
  handleGoogleHasScopes,
  handleGoogleFetch
} from "./handlers/google";
import { handleWebSocketClose, handleWebSocketConnect, handleWebSocketSend } from "./handlers/ws";

const log = createLogger("content-router");

export function registerPageRouter(): void {
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;

    const data = event.data as PageToContentMessage | undefined;
    if (!data || data.source !== BRIDGE_SOURCE) return;

    if (data.type === PAGE_MSG.BRIDGE_READY) {
      log.info("Bridge ready", data.payload?.version);
      return;
    }

    if (data.type === PAGE_MSG.FETCH_ABORT) {
      if (!data.payload?.requestId) return;
      await handleFetchAbort(data.payload.requestId);
      return;
    }

    if (data.type === PAGE_MSG.KEY_CHECK_REQUEST) {
      await handleKeyCheck(data.payload.checkId, data.payload.keyName);
      return;
    }

    if (data.type === PAGE_MSG.KEYS_REQUEST) {
      await handleKeysRequest(data.payload.keysId);
      return;
    }

    if (data.type === PAGE_MSG.STATUS_REQUEST) {
      await handleStatusRequest(data.payload.statusId);
      return;
    }

    if (data.type === PAGE_MSG.FETCH_REQUEST) {
      await handleFetchRequest(data.payload);
      return;
    }

    if (data.type === PAGE_MSG.STREAM_REQUEST) {
      await handleStreamRequest(data.payload);
      return;
    }

    if (data.type === PAGE_MSG.STREAM_ABORT) {
      if (!data.payload?.requestId) return;
      await handleStreamAbort(data.payload.requestId);
      return;
    }

    if (data.type === PAGE_MSG.GOOGLE_AUTH_REQUEST) {
      await handleGoogleAuth(data.payload.authId, data.payload.scopes);
      return;
    }

    if (data.type === PAGE_MSG.GOOGLE_LOGOUT_REQUEST) {
      await handleGoogleLogout(data.payload.logoutId);
      return;
    }

    if (data.type === PAGE_MSG.GOOGLE_STATE_REQUEST) {
      await handleGoogleState(data.payload.stateId);
      return;
    }

    if (data.type === PAGE_MSG.GOOGLE_HAS_SCOPES_REQUEST) {
      await handleGoogleHasScopes(data.payload.scopesId, data.payload.scopes);
      return;
    }

    if (data.type === PAGE_MSG.GOOGLE_FETCH_REQUEST) {
      await handleGoogleFetch(data.payload);
    }

    if (data.type === PAGE_MSG.WS_CONNECT) {
      await handleWebSocketConnect(data.payload);
      return;
    }

    if (data.type === PAGE_MSG.WS_SEND) {
      handleWebSocketSend(data.payload);
      return;
    }

    if (data.type === PAGE_MSG.WS_CLOSE) {
      handleWebSocketClose(data.payload);
    }
  });
}
