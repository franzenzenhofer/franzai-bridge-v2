/// <reference types="vitest" />
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BridgeSettings, LogEntry } from "../src/shared/types";
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from "../src/shared/defaults";

// Mock chrome storage API
const mockLocalStorage = new Map<string, unknown>();
const mockSessionStorage = new Map<string, unknown>();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        const data: Record<string, unknown> = {};
        data[key] = mockLocalStorage.get(key);
        return data;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) {
          mockLocalStorage.set(k, v);
        }
      }),
      remove: vi.fn(async (key: string) => {
        mockLocalStorage.delete(key);
      })
    },
    session: {
      get: vi.fn(async (key: string) => {
        const data: Record<string, unknown> = {};
        data[key] = mockSessionStorage.get(key);
        return data;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) {
          mockSessionStorage.set(k, v);
        }
      }),
      remove: vi.fn(async (key: string) => {
        mockSessionStorage.delete(key);
      })
    }
  }
});

describe("storage", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  describe("getSettings", () => {
    it("returns default settings when storage is empty", async () => {
      const { getSettings } = await import("../src/shared/storage");
      const settings = await getSettings();

      expect(settings.allowedOrigins).toEqual(DEFAULT_SETTINGS.allowedOrigins);
      expect(settings.allowedDestinations).toEqual(DEFAULT_SETTINGS.allowedDestinations);
      expect(settings.maxLogs).toBe(DEFAULT_SETTINGS.maxLogs);
    });

    it("returns stored settings when available (with current version)", async () => {
      const storedSettings: BridgeSettings = {
        settingsVersion: SETTINGS_VERSION,  // Current version - no migration
        allowedOrigins: ["https://custom.com"],
        allowedDestinations: ["api.custom.com"],
        env: { CUSTOM_KEY: "value" },
        injectionRules: [],
        maxLogs: 500
      };
      mockLocalStorage.set("franzaiSettings", storedSettings);

      const { getSettings } = await import("../src/shared/storage");
      const settings = await getSettings();

      expect(settings.allowedOrigins).toEqual(["https://custom.com"]);
      expect(settings.maxLogs).toBe(500);
    });

    it("migrates old settings (missing version) preserving ENV vars", async () => {
      const oldSettings = {
        // No settingsVersion - triggers migration
        allowedOrigins: ["https://old.com"],
        allowedDestinations: ["old.api.com"],
        env: { MY_API_KEY: "secret-key-123" },
        injectionRules: [{ hostPattern: "*.custom.com", injectHeaders: { "X-Custom": "yes" } }],
        maxLogs: 100
      };
      mockLocalStorage.set("franzaiSettings", oldSettings);

      const { getSettings } = await import("../src/shared/storage");
      const settings = await getSettings();

      // Should have new defaults
      expect(settings.allowedOrigins).toEqual(["*"]);
      expect(settings.allowedDestinations).toEqual(["*"]);
      expect(settings.settingsVersion).toBe(SETTINGS_VERSION);

      // But preserve user's ENV vars
      expect(settings.env.MY_API_KEY).toBe("secret-key-123");

      // And preserve custom injection rules
      expect(settings.injectionRules).toHaveLength(1);
      expect(settings.injectionRules[0].hostPattern).toBe("*.custom.com");
    });

    it("normalizes settings when loaded (with current version)", async () => {
      // Store settings with current version but invalid maxLogs
      mockLocalStorage.set("franzaiSettings", {
        settingsVersion: SETTINGS_VERSION,
        allowedOrigins: ["*"],
        allowedDestinations: ["*"],
        env: {},
        injectionRules: [],
        maxLogs: 99999  // Invalid - will be clamped
      });

      const { getSettings } = await import("../src/shared/storage");
      const settings = await getSettings();

      // Should be clamped to MAX_LOGS_LIMIT
      expect(settings.maxLogs).toBe(1000);
    });
  });

  describe("setSettings", () => {
    it("stores settings to local storage", async () => {
      const { setSettings } = await import("../src/shared/storage");

      const settings: BridgeSettings = {
        settingsVersion: SETTINGS_VERSION,
        allowedOrigins: ["https://example.com"],
        allowedDestinations: ["api.example.com"],
        env: {},
        injectionRules: [],
        maxLogs: 300
      };

      await setSettings(settings);

      const stored = mockLocalStorage.get("franzaiSettings") as BridgeSettings;
      expect(stored.allowedOrigins).toEqual(["https://example.com"]);
      expect(stored.maxLogs).toBe(300);
      expect(stored.settingsVersion).toBe(SETTINGS_VERSION);
    });

    it("normalizes settings before storing", async () => {
      const { setSettings } = await import("../src/shared/storage");

      await setSettings({ settingsVersion: SETTINGS_VERSION, maxLogs: 5 } as BridgeSettings);

      const stored = mockLocalStorage.get("franzaiSettings") as BridgeSettings;
      // Should be clamped to MIN_LOGS_LIMIT (10)
      expect(stored.maxLogs).toBe(10);
    });
  });

  describe("getLogs", () => {
    it("returns empty array when no logs stored", async () => {
      const { getLogs } = await import("../src/shared/storage");
      const logs = await getLogs();

      expect(logs).toEqual([]);
    });

    it("returns stored logs from session storage", async () => {
      const storedLogs: LogEntry[] = [
        {
          id: "log_1",
          requestId: "req_1",
          ts: Date.now(),
          pageOrigin: "https://example.com",
          url: "https://api.example.com/test",
          method: "GET",
          requestHeaders: {},
          requestBodyPreview: ""
        }
      ];
      mockSessionStorage.set("franzaiLogs", storedLogs);

      const { getLogs } = await import("../src/shared/storage");
      const logs = await getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe("log_1");
    });
  });

  describe("setLogs", () => {
    it("stores logs to session storage", async () => {
      const { setLogs } = await import("../src/shared/storage");

      const logs: LogEntry[] = [
        {
          id: "log_2",
          requestId: "req_2",
          ts: Date.now(),
          pageOrigin: "https://example.com",
          url: "https://api.example.com/data",
          method: "POST",
          requestHeaders: { "Content-Type": "application/json" },
          requestBodyPreview: '{"test": true}'
        }
      ];

      await setLogs(logs);

      const stored = mockSessionStorage.get("franzaiLogs") as LogEntry[];
      expect(stored).toHaveLength(1);
      expect(stored[0].method).toBe("POST");
    });
  });

  describe("appendLog", () => {
    it("prepends new log to existing logs", async () => {
      const { appendLog, getLogs } = await import("../src/shared/storage");

      const existingLog: LogEntry = {
        id: "log_old",
        requestId: "req_old",
        ts: Date.now() - 1000,
        pageOrigin: "https://old.com",
        url: "https://api.old.com",
        method: "GET",
        requestHeaders: {},
        requestBodyPreview: ""
      };
      mockSessionStorage.set("franzaiLogs", [existingLog]);

      const newLog: LogEntry = {
        id: "log_new",
        requestId: "req_new",
        ts: Date.now(),
        pageOrigin: "https://new.com",
        url: "https://api.new.com",
        method: "POST",
        requestHeaders: {},
        requestBodyPreview: ""
      };

      await appendLog(newLog, 100);
      const logs = await getLogs();

      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe("log_new"); // New log is first
      expect(logs[1].id).toBe("log_old");
    });

    it("respects maxLogs limit", async () => {
      const { appendLog, getLogs, setLogs } = await import("../src/shared/storage");

      // Fill with 5 logs
      const existingLogs: LogEntry[] = [];
      for (let i = 0; i < 5; i++) {
        existingLogs.push({
          id: `log_${i}`,
          requestId: `req_${i}`,
          ts: Date.now() - i * 1000,
          pageOrigin: "https://example.com",
          url: "https://api.example.com",
          method: "GET",
          requestHeaders: {},
          requestBodyPreview: ""
        });
      }
      await setLogs(existingLogs);

      // Append with maxLogs = 3
      const newLog: LogEntry = {
        id: "log_new",
        requestId: "req_new",
        ts: Date.now(),
        pageOrigin: "https://new.com",
        url: "https://api.new.com",
        method: "POST",
        requestHeaders: {},
        requestBodyPreview: ""
      };

      await appendLog(newLog, 3);
      const logs = await getLogs();

      expect(logs).toHaveLength(3);
      expect(logs[0].id).toBe("log_new"); // Newest first
    });
  });

  describe("clearLogs", () => {
    it("removes logs from session storage", async () => {
      const { clearLogs, getLogs, setLogs } = await import("../src/shared/storage");

      const logs: LogEntry[] = [
        {
          id: "log_1",
          requestId: "req_1",
          ts: Date.now(),
          pageOrigin: "https://example.com",
          url: "https://api.example.com",
          method: "GET",
          requestHeaders: {},
          requestBodyPreview: ""
        }
      ];
      await setLogs(logs);

      await clearLogs();
      const cleared = await getLogs();

      expect(cleared).toEqual([]);
    });
  });
});
