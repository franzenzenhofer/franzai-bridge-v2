// Background Service Worker - Entry Point

import { createPortHub } from "./background/ports";
import { registerLifecycleHandlers } from "./background/lifecycle";
import { registerMessageRouter } from "./background/router";
import { maybeAutoOpenSidepanel } from "./background/auto-open";
import { registerStreamHandlers } from "./background/stream";
import { registerWebSocketHandlers } from "./background/ws";

const portHub = createPortHub();

registerLifecycleHandlers(portHub);
registerMessageRouter({
  broadcast: portHub.broadcast,
  maybeAutoOpenSidepanel
});
registerStreamHandlers(portHub.broadcast);
registerWebSocketHandlers();
