import { BRIDGE_SOURCE } from "../shared/constants";
import { PAGE_MSG } from "../shared/messages";
import { makeId } from "../shared/ids";
import { getCachedDomainEnabledValue } from "./domain-status";
import { createLogger } from "../shared/logger";
import type { BridgeConfig } from "./types";

const log = createLogger("page-ws");
export function createHookedWebSocket(nativeWebSocket: typeof WebSocket, bridgeConfig: BridgeConfig): typeof WebSocket {
  const sockets = new Map<string, FranzaiWebSocket>();
  let listenerInstalled = false;
  class FranzaiWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readonly url: string;
    protocol = "";
    extensions = "";
    readyState = FranzaiWebSocket.CONNECTING;
    bufferedAmount = 0;
    private _binaryType: BinaryType = "blob";

    onopen: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;

    private socketId: string | null = null;
    private native: WebSocket | null = null;

    constructor(url: string | URL, protocols?: string | string[]) {
      super();
      this.url = new URL(url.toString(), window.location.href).toString();

      const domainEnabled = getCachedDomainEnabledValue();
      if (bridgeConfig.mode === "off" || domainEnabled !== true) {
        this.native = new nativeWebSocket(this.url, protocols as string | string[] | undefined);
        this.native.binaryType = this._binaryType;
        bindNativeSocket(this, this.native);
        return;
      }

      installListener();
      this.socketId = makeId("ws");
      sockets.set(this.socketId, this);

      const protocolList = Array.isArray(protocols)
        ? protocols
        : typeof protocols === "string"
          ? [protocols]
          : undefined;

      window.postMessage({
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.WS_CONNECT,
        payload: {
          socketId: this.socketId,
          url: this.url,
          protocols: protocolList,
          pageOrigin: window.location.origin
        }
      }, "*");
    }

    get binaryType(): BinaryType {
      return this._binaryType;
    }

    set binaryType(value: BinaryType) {
      this._binaryType = value;
      if (this.native) this.native.binaryType = value;
    }

    send(data: string | ArrayBuffer | ArrayBufferView | Blob): void {
      if (this.native) {
        this.native.send(data);
        return;
      }
      if (!this.socketId) return;
      if (this.readyState !== FranzaiWebSocket.OPEN) {
        throw new DOMException("WebSocket is not open", "InvalidStateError");
      }

      if (typeof data === "string") {
        postWs(PAGE_MSG.WS_SEND, { socketId: this.socketId, data });
        return;
      }

      if (data instanceof ArrayBuffer) {
        postWs(PAGE_MSG.WS_SEND, { socketId: this.socketId, data: new Uint8Array(data) });
        return;
      }

      if (ArrayBuffer.isView(data)) {
        postWs(PAGE_MSG.WS_SEND, { socketId: this.socketId, data: new Uint8Array(data.buffer) });
        return;
      }

      if (data instanceof Blob) {
        data.arrayBuffer().then((buffer) => {
          postWs(PAGE_MSG.WS_SEND, { socketId: this.socketId, data: new Uint8Array(buffer) });
        }).catch((err) => {
          log.warn("Failed to send Blob", err);
        });
      }
    }

    close(code?: number, reason?: string): void {
      if (this.native) {
        this.native.close(code, reason);
        return;
      }
      if (!this.socketId) return;
      if (this.readyState === FranzaiWebSocket.CLOSING || this.readyState === FranzaiWebSocket.CLOSED) return;
      this.readyState = FranzaiWebSocket.CLOSING;
      postWs(PAGE_MSG.WS_CLOSE, { socketId: this.socketId, code, reason });
    }
  }

  function installListener(): void {
    if (listenerInstalled) return;
    listenerInstalled = true;

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data as { source?: string; type?: string; payload?: unknown };
      if (!data || data.source !== BRIDGE_SOURCE) return;

      if (data.type === PAGE_MSG.WS_OPEN) {
        const payload = data.payload as { socketId: string; protocol?: string };
        const socket = sockets.get(payload.socketId);
        if (!socket) return;
        socket.protocol = payload.protocol ?? "";
        socket.readyState = FranzaiWebSocket.OPEN;
        emitEvent(socket, "open");
      }

      if (data.type === PAGE_MSG.WS_MESSAGE) {
        const payload = data.payload as { socketId: string; data: string | Uint8Array };
        const socket = sockets.get(payload.socketId);
        if (!socket) return;
        const messageData = normalizeMessageData(payload.data, socket.binaryType);
        emitMessage(socket, messageData);
      }

      if (data.type === PAGE_MSG.WS_ERROR) {
        const payload = data.payload as { socketId: string; message: string };
        const socket = sockets.get(payload.socketId);
        if (!socket) return;
        emitError(socket);
      }

      if (data.type === PAGE_MSG.WS_CLOSED) {
        const payload = data.payload as { socketId: string; code?: number; reason?: string; wasClean?: boolean };
        const socket = sockets.get(payload.socketId);
        if (!socket) return;
        socket.readyState = FranzaiWebSocket.CLOSED;
        emitClose(socket, payload.code, payload.reason, payload.wasClean);
        sockets.delete(payload.socketId);
      }
    });
  }

  function postWs(type: string, payload: unknown): void {
    window.postMessage({ source: BRIDGE_SOURCE, type, payload }, "*");
  }

  return FranzaiWebSocket as unknown as typeof WebSocket;
}

function normalizeMessageData(data: string | Uint8Array, binaryType: BinaryType): string | ArrayBuffer | Blob {
  if (typeof data === "string") return data;
  const buffer = data.buffer instanceof ArrayBuffer
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : new Uint8Array(data).buffer;
  if (binaryType === "arraybuffer") return buffer;
  return new Blob([buffer]);
}

function emitEvent(socket: EventTarget & { onopen: ((ev: Event) => void) | null }, type: string): void {
  const event = new Event(type);
  socket.dispatchEvent(event);
  socket.onopen?.(event);
}

function emitMessage(socket: EventTarget & { onmessage: ((ev: MessageEvent) => void) | null }, data: string | ArrayBuffer | Blob): void {
  const event = new MessageEvent("message", { data });
  socket.dispatchEvent(event);
  socket.onmessage?.(event);
}

function emitError(socket: EventTarget & { onerror: ((ev: Event) => void) | null }): void {
  const event = new Event("error");
  socket.dispatchEvent(event);
  socket.onerror?.(event);
}

function emitClose(
  socket: EventTarget & { onclose: ((ev: CloseEvent) => void) | null },
  code?: number,
  reason?: string,
  wasClean?: boolean
): void {
  const event = new CloseEvent("close", {
    code: code ?? 1000,
    reason: reason ?? "",
    wasClean: wasClean ?? true
  });
  socket.dispatchEvent(event);
  socket.onclose?.(event);
}

function bindNativeSocket(wrapper: any, nativeSocket: WebSocket): void {
  nativeSocket.onopen = (ev) => {
    wrapper.readyState = WebSocket.OPEN;
    wrapper.protocol = nativeSocket.protocol;
    wrapper.extensions = nativeSocket.extensions;
    wrapper.dispatchEvent(ev);
    wrapper.onopen?.(ev);
  };

  nativeSocket.onmessage = (ev) => {
    wrapper.dispatchEvent(ev);
    wrapper.onmessage?.(ev);
  };

  nativeSocket.onerror = (ev) => {
    wrapper.dispatchEvent(ev);
    wrapper.onerror?.(ev);
  };

  nativeSocket.onclose = (ev) => {
    wrapper.readyState = WebSocket.CLOSED;
    wrapper.dispatchEvent(ev);
    wrapper.onclose?.(ev);
  };
}
