import { getBridgeWindow, type BridgeWindow } from "./window";

export type CaptureState = {
  win: BridgeWindow;
  alreadyInstalled: boolean;
  nativeFetch: typeof fetch;
  nativeRequest: typeof Request;
  nativeWebSocket: typeof WebSocket;
  nativeFetchDescriptor: PropertyDescriptor | null;
  nativeRequestDescriptor: PropertyDescriptor | null;
  nativeWebSocketDescriptor: PropertyDescriptor | null;
};

export function captureGlobals(): CaptureState {
  const win = getBridgeWindow();
  const alreadyInstalled = !!win.__franzaiBridgeInstalled;

  const nativeFetch = alreadyInstalled
    ? (win.__franzaiNativeFetch as typeof fetch)
    : window.fetch.bind(window);
  const nativeRequest = alreadyInstalled
    ? (win.__franzaiNativeRequest as typeof Request)
    : window.Request;
  const nativeWebSocket = alreadyInstalled
    ? (win.__franzaiNativeWebSocket as typeof WebSocket)
    : window.WebSocket;
  const nativeFetchDescriptor = alreadyInstalled
    ? (win.__franzaiNativeFetchDescriptor ?? null)
    : (Object.getOwnPropertyDescriptor(window, "fetch") ?? null);
  const nativeRequestDescriptor = alreadyInstalled
    ? (win.__franzaiNativeRequestDescriptor ?? null)
    : (Object.getOwnPropertyDescriptor(window, "Request") ?? null);
  const nativeWebSocketDescriptor = alreadyInstalled
    ? (win.__franzaiNativeWebSocketDescriptor ?? null)
    : (Object.getOwnPropertyDescriptor(window, "WebSocket") ?? null);

  if (!alreadyInstalled) {
    Object.defineProperties(win, {
      __franzaiNativeFetch: {
        value: nativeFetch,
        writable: false,
        configurable: false,
        enumerable: false
      },
      __franzaiNativeRequest: {
        value: nativeRequest,
        writable: false,
        configurable: false,
        enumerable: false
      },
      __franzaiNativeFetchDescriptor: {
        value: nativeFetchDescriptor,
        writable: false,
        configurable: false,
        enumerable: false
      },
      __franzaiNativeRequestDescriptor: {
        value: nativeRequestDescriptor,
        writable: false,
        configurable: false,
        enumerable: false
      },
      __franzaiNativeWebSocket: {
        value: nativeWebSocket,
        writable: false,
        configurable: false,
        enumerable: false
      },
      __franzaiNativeWebSocketDescriptor: {
        value: nativeWebSocketDescriptor,
        writable: false,
        configurable: false,
        enumerable: false
      },
      __franzaiBridgeInstalled: {
        value: true,
        writable: false,
        configurable: false,
        enumerable: false
      }
    });
  }

  return {
    win,
    alreadyInstalled,
    nativeFetch,
    nativeRequest,
    nativeWebSocket,
    nativeFetchDescriptor,
    nativeRequestDescriptor,
    nativeWebSocketDescriptor
  };
}
