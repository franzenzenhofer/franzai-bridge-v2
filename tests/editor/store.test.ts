/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from "vitest";

function createLocalStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    }
  };
}

async function loadStore() {
  const store = await import("../../src/editor/state/store");
  store.hydrateFromLocalStorage();
  return store;
}

describe("editor store history", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createLocalStorage(),
      configurable: true
    });
    vi.resetModules();
  });

  it("pushHistory/undo/redo updates code and history index", async () => {
    const store = await loadStore();
    const initialCode = store.getState().code;

    store.pushHistory("<html>one</html>");
    expect(store.getState().code).toBe("<html>one</html>");
    expect(store.getState().historyIndex).toBe(store.getState().history.length - 1);
    expect(store.canUndo()).toBe(true);

    const didUndo = store.undo();
    expect(didUndo).toBe(true);
    expect(store.getState().code).toBe(initialCode);

    const didRedo = store.redo();
    expect(didRedo).toBe(true);
    expect(store.getState().code).toBe("<html>one</html>");
  });
});
