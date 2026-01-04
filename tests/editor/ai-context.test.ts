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

async function loadModules() {
  const store = await import("../../src/editor/state/store");
  const ctx = await import("../../src/editor/services/ai-context");
  store.hydrateFromLocalStorage();
  return { store, ctx };
}

describe("ai-context", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createLocalStorage(),
      configurable: true
    });
    vi.resetModules();
  });

  it("builds a stable system prompt snapshot", async () => {
    const { store, ctx } = await loadModules();

    store.setState({
      projectName: "Snapshot Project",
      code: "<!DOCTYPE html><html><head><title>Snapshot</title></head><body><main>Hi</main></body></html>",
      previousCode: "<!DOCTYPE html><html><head><title>Prev</title></head><body>Prev</body></html>",
      keys: { openai: true, anthropic: false, google: true },
      logs: [],
      contextFiles: [
        { id: "ctx_1", name: "Pricing", content: "{\"tier\":\"pro\"}", updatedAt: 0 }
      ]
    });

    const prompt = ctx.buildSystemPrompt();
    expect(prompt).toMatchSnapshot();
  });
});
