import { WS_MSG, type WebSocketPortMessage } from "../shared/ws-types";
import { WS_PORT_NAME } from "../shared/constants";
import { createLogger } from "../shared/logger";
import { getSettings } from "../shared/storage";
import { applyInjectionRules, isDestinationAllowed, isOriginAllowed } from "../shared/policy";
import { builtinProviderRules } from "../shared/providers";
import type { Dict } from "../shared/types";

const log = createLogger("ws");

const sockets = new Map<string, WebSocket>();
const socketPorts = new Map<string, chrome.runtime.Port>();

export function registerWebSocketHandlers(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== WS_PORT_NAME) return;

    port.onMessage.addListener((msg: WebSocketPortMessage) => {
      if (msg.type === WS_MSG.OPEN) {
        handleOpen(msg.payload, port);
        return;
      }
      if (msg.type === WS_MSG.SEND) {
        handleSend(msg.payload.socketId, msg.payload.data);
        return;
      }
      if (msg.type === WS_MSG.CLOSE) {
        handleClose(msg.payload.socketId, msg.payload.code, msg.payload.reason);
      }
    });

    port.onDisconnect.addListener(() => {
      for (const [socketId, socketPort] of socketPorts.entries()) {
        if (socketPort === port) {
          handleClose(socketId);
        }
      }
    });
  });
}

async function handleOpen(payload: { socketId: string; url: string; protocols?: string[]; pageOrigin: string }, port: chrome.runtime.Port): Promise<void> {
  const settings = await getSettings();

  if (!isOriginAllowed(payload.pageOrigin, settings.allowedOrigins)) {
    port.postMessage({ type: WS_MSG.ERROR, payload: { socketId: payload.socketId, message: "Origin not allowed." } });
    return;
  }

  let url: URL;
  try {
    url = new URL(payload.url);
  } catch {
    port.postMessage({ type: WS_MSG.ERROR, payload: { socketId: payload.socketId, message: "Invalid WebSocket URL." } });
    return;
  }

  if (!isDestinationAllowed(url, settings.allowedDestinations)) {
    port.postMessage({ type: WS_MSG.ERROR, payload: { socketId: payload.socketId, message: "Destination not allowed." } });
    return;
  }

  const headers: Dict<string> = {};
  const allRules = [...builtinProviderRules(), ...settings.injectionRules];
  applyInjectionRules({ url, headers, env: settings.env, rules: allRules });

  let socket: WebSocket;
  try {
    socket = new WebSocket(url.toString(), payload.protocols);
  } catch (e) {
    port.postMessage({ type: WS_MSG.ERROR, payload: { socketId: payload.socketId, message: String(e) } });
    return;
  }

  sockets.set(payload.socketId, socket);
  socketPorts.set(payload.socketId, port);

  socket.binaryType = "arraybuffer";

  socket.onopen = () => {
    port.postMessage({ type: WS_MSG.OPEN, payload: { socketId: payload.socketId, protocol: socket.protocol } });
  };

  socket.onmessage = (event) => {
    const data = event.data;
    if (typeof data === "string") {
      port.postMessage({ type: WS_MSG.MESSAGE, payload: { socketId: payload.socketId, data } });
      return;
    }
    if (data instanceof ArrayBuffer) {
      port.postMessage({ type: WS_MSG.MESSAGE, payload: { socketId: payload.socketId, data: new Uint8Array(data) } });
      return;
    }
    if (data instanceof Blob) {
      data.arrayBuffer().then((buffer) => {
        port.postMessage({ type: WS_MSG.MESSAGE, payload: { socketId: payload.socketId, data: new Uint8Array(buffer) } });
      });
    }
  };

  socket.onerror = () => {
    port.postMessage({ type: WS_MSG.ERROR, payload: { socketId: payload.socketId, message: "WebSocket error." } });
  };

  socket.onclose = (event) => {
    port.postMessage({
      type: WS_MSG.CLOSE,
      payload: {
        socketId: payload.socketId,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      }
    });
    sockets.delete(payload.socketId);
    socketPorts.delete(payload.socketId);
  };

  log.info("WebSocket opened", { socketId: payload.socketId, url: url.toString() });
}

function handleSend(socketId: string, data: string | Uint8Array): void {
  const socket = sockets.get(socketId);
  if (!socket) return;
  try {
    socket.send(data);
  } catch (e) {
    const port = socketPorts.get(socketId);
    port?.postMessage({ type: WS_MSG.ERROR, payload: { socketId, message: String(e) } });
  }
}

function handleClose(socketId: string, code?: number, reason?: string): void {
  const socket = sockets.get(socketId);
  if (!socket) return;
  try {
    socket.close(code, reason);
  } catch {
    // ignore
  }
  sockets.delete(socketId);
  socketPorts.delete(socketId);
}
