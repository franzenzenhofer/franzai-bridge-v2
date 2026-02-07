import { describe, expect, it, vi, beforeEach } from "vitest";
import { BG_EVT } from "../src/shared/messages";
import { initRuntimeListeners } from "../src/sidepanel/runtime";

type PortListener = (evt: { type: string }) => void;
type DisconnectListener = () => void;
type TabsActivatedListener = () => void;
type TabsUpdatedListener = (tabId: number, changeInfo: { url?: string; status?: string }, tab: { active?: boolean }) => void;

function setupChromeMocks() {
  const messageListenersByPort: PortListener[][] = [];
  const disconnectListenersByPort: DisconnectListener[][] = [];
  const activatedListeners: TabsActivatedListener[] = [];
  const updatedListeners: TabsUpdatedListener[] = [];

  const connect = vi.fn(() => {
    const messageListeners: PortListener[] = [];
    const disconnectListeners: DisconnectListener[] = [];
    messageListenersByPort.push(messageListeners);
    disconnectListenersByPort.push(disconnectListeners);

    return {
      name: "FRANZAI_SIDEPANEL",
      onMessage: {
        addListener(fn: PortListener) {
          messageListeners.push(fn);
        }
      },
      onDisconnect: {
        addListener(fn: DisconnectListener) {
          disconnectListeners.push(fn);
        }
      }
    };
  });

  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      connect,
      lastError: null as { message: string } | null
    },
    tabs: {
      onActivated: {
        addListener(fn: TabsActivatedListener) {
          activatedListeners.push(fn);
        }
      },
      onUpdated: {
        addListener(fn: TabsUpdatedListener) {
          updatedListeners.push(fn);
        }
      }
    }
  };

  return {
    connect,
    messageListenersByPort,
    disconnectListenersByPort,
    activatedListeners,
    updatedListeners
  };
}

describe("sidepanel runtime listeners", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes logs when background broadcasts LOGS_UPDATED", async () => {
    const mocks = setupChromeMocks();
    const onRefresh = vi.fn(async () => {});
    const onDomainPrefs = vi.fn(async () => {});
    const onActiveTab = vi.fn(async () => {});

    initRuntimeListeners({ onRefresh, onDomainPrefs, onActiveTab });

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    // Initial sync on connect.
    expect(onRefresh).toHaveBeenCalledTimes(1);

    const firstPortMessageListeners = mocks.messageListenersByPort[0];
    expect(firstPortMessageListeners).toBeDefined();
    firstPortMessageListeners?.[0]?.({ type: BG_EVT.LOGS_UPDATED });
    await Promise.resolve();

    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(onDomainPrefs).not.toHaveBeenCalled();
  });

  it("reconnects after port disconnect and continues live updates", async () => {
    vi.useFakeTimers();
    const mocks = setupChromeMocks();
    const onRefresh = vi.fn(async () => {});
    const onDomainPrefs = vi.fn(async () => {});
    const onActiveTab = vi.fn(async () => {});

    initRuntimeListeners({ onRefresh, onDomainPrefs, onActiveTab });
    expect(mocks.connect).toHaveBeenCalledTimes(1);

    const firstPortDisconnectListeners = mocks.disconnectListenersByPort[0];
    expect(firstPortDisconnectListeners).toBeDefined();
    firstPortDisconnectListeners?.[0]?.();

    vi.advanceTimersByTime(500);
    await Promise.resolve();

    expect(mocks.connect).toHaveBeenCalledTimes(2);
    // initial connect + reconnect sync
    expect(onRefresh).toHaveBeenCalledTimes(2);

    const secondPortMessageListeners = mocks.messageListenersByPort[1];
    expect(secondPortMessageListeners).toBeDefined();
    secondPortMessageListeners?.[0]?.({ type: BG_EVT.LOGS_UPDATED });
    await Promise.resolve();

    expect(onRefresh).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("refreshes active tab domain on tab updates", async () => {
    vi.useFakeTimers();
    const mocks = setupChromeMocks();
    const onRefresh = vi.fn(async () => {});
    const onDomainPrefs = vi.fn(async () => {});
    const onActiveTab = vi.fn(async () => {});

    initRuntimeListeners({ onRefresh, onDomainPrefs, onActiveTab });

    const updatedListener = mocks.updatedListeners[0];
    expect(updatedListener).toBeDefined();
    updatedListener?.(1, { status: "complete" }, { active: true });

    vi.advanceTimersByTime(150);
    await Promise.resolve();

    expect(onActiveTab).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
