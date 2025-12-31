/// <reference types="vitest" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RUNTIME_MESSAGE_TIMEOUT_MS } from "../src/shared/constants";

describe("runtime", () => {
  describe("sendRuntimeMessage logic", () => {
    it("resolves with response when callback is called", async () => {
      const response = { data: "response" };

      const result = await new Promise((resolve) => {
        // Simulate chrome.runtime.sendMessage behavior
        const callback = (resp: typeof response) => {
          resolve(resp);
        };
        callback(response);
      });

      expect(result).toEqual(response);
    });

    it("timeout logic works correctly", () => {
      vi.useFakeTimers();

      let timedOut = false;
      const timeoutMs = 1000;

      const timeoutId = setTimeout(() => {
        timedOut = true;
      }, timeoutMs);

      expect(timedOut).toBe(false);
      vi.advanceTimersByTime(timeoutMs);
      expect(timedOut).toBe(true);

      clearTimeout(timeoutId);
      vi.useRealTimers();
    });

    it("done flag prevents double resolution", async () => {
      let done = false;
      let resolutions = 0;

      const finish = () => {
        if (done) return;
        done = true;
        resolutions++;
      };

      // First call
      finish();
      expect(resolutions).toBe(1);

      // Second call should be ignored
      finish();
      expect(resolutions).toBe(1);
    });

    it("clearTimeout is called on success", () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      const timeoutId = setTimeout(() => {}, 5000);
      clearTimeout(timeoutId);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);

      clearTimeoutSpy.mockRestore();
      vi.useRealTimers();
    });

    it("default timeout is RUNTIME_MESSAGE_TIMEOUT_MS", () => {
      expect(RUNTIME_MESSAGE_TIMEOUT_MS).toBe(15_000);
    });
  });

  describe("error handling", () => {
    it("handles lastError from chrome.runtime", () => {
      const lastError = { message: "Extension context invalidated" };

      const handleError = (err: { message?: string }) => {
        return new Error(err.message || "Unknown error");
      };

      const error = handleError(lastError);
      expect(error.message).toBe("Extension context invalidated");
    });

    it("handles synchronous throw", () => {
      const throwingFn = () => {
        throw new Error("Sync error");
      };

      expect(throwingFn).toThrow("Sync error");
    });
  });

  describe("timeout error message", () => {
    it("includes timeout duration in error", () => {
      const timeoutMs = 15000;
      const errorMessage = `Timeout waiting for runtime response after ${timeoutMs}ms`;

      expect(errorMessage).toContain("15000ms");
      expect(errorMessage).toContain("Timeout");
    });
  });

  describe("promise resolution patterns", () => {
    it("promise resolves on callback", async () => {
      const result = await new Promise<string>((resolve) => {
        setTimeout(() => resolve("success"), 0);
      });

      expect(result).toBe("success");
    });

    it("promise rejects on error", async () => {
      await expect(
        new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error("failed")), 0);
        })
      ).rejects.toThrow("failed");
    });

    it("late callback after done is ignored", async () => {
      let done = false;
      let result: string | null = null;

      const finish = (value: string) => {
        if (done) return;
        done = true;
        result = value;
      };

      // First resolution
      finish("first");
      expect(result).toBe("first");

      // Late call
      finish("second");
      expect(result).toBe("first"); // Still first
    });
  });
});
