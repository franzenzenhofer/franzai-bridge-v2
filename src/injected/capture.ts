import { getBridgeWindow, type BridgeWindow } from "./window";

export type CaptureState = {
  win: BridgeWindow;
  alreadyInstalled: boolean;
  nativeFetch: typeof fetch;
  nativeRequest: typeof Request;
  nativeFetchDescriptor: PropertyDescriptor | null;
  nativeRequestDescriptor: PropertyDescriptor | null;
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
  const nativeFetchDescriptor = alreadyInstalled
    ? (win.__franzaiNativeFetchDescriptor ?? null)
    : (Object.getOwnPropertyDescriptor(window, "fetch") ?? null);
  const nativeRequestDescriptor = alreadyInstalled
    ? (win.__franzaiNativeRequestDescriptor ?? null)
    : (Object.getOwnPropertyDescriptor(window, "Request") ?? null);

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
    nativeFetchDescriptor,
    nativeRequestDescriptor
  };
}
