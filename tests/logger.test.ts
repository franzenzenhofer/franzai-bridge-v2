/// <reference types="vitest" />
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createLogger, type LogLevel } from "../src/shared/logger";

describe("logger", () => {
  const createMockConsole = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn()
  });

  beforeEach(() => {
    delete (globalThis as { __FRANZAI_LOG_LEVEL__?: unknown }).__FRANZAI_LOG_LEVEL__;
  });

  describe("createLogger", () => {
    it("creates logger with scope prefix", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("test", "debug", mockConsole);

      logger.info("hello");

      expect(mockConsole.info).toHaveBeenCalledWith("[FranzAI Bridge/test]", "hello");
    });

    it("supports debug level", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("scope", "debug", mockConsole);

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      expect(mockConsole.debug).toHaveBeenCalledWith("[FranzAI Bridge/scope]", "debug msg");
      expect(mockConsole.info).toHaveBeenCalledWith("[FranzAI Bridge/scope]", "info msg");
      expect(mockConsole.warn).toHaveBeenCalledWith("[FranzAI Bridge/scope]", "warn msg");
      expect(mockConsole.error).toHaveBeenCalledWith("[FranzAI Bridge/scope]", "error msg");
    });

    it("filters logs below info level when set to info", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("scope", "info", mockConsole);

      logger.debug("debug msg");
      logger.info("info msg");

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it("filters logs below warn level when set to warn", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("scope", "warn", mockConsole);

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it("filters logs below error level when set to error", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("scope", "error", mockConsole);

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it("silences all logs when set to silent", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("scope", "silent", mockConsole);

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");
      logger.log("log msg");

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("log method uses info level threshold", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("scope", "info", mockConsole);

      logger.log("log msg");

      expect(mockConsole.log).toHaveBeenCalledWith("[FranzAI Bridge/scope]", "log msg");
    });

    it("supports multiple arguments", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("scope", "debug", mockConsole);

      logger.info("msg1", "msg2", { key: "value" });

      expect(mockConsole.info).toHaveBeenCalledWith(
        "[FranzAI Bridge/scope]",
        "msg1",
        "msg2",
        { key: "value" }
      );
    });

    it("reads level from global __FRANZAI_LOG_LEVEL__ if not specified", () => {
      (globalThis as { __FRANZAI_LOG_LEVEL__?: unknown }).__FRANZAI_LOG_LEVEL__ = "warn";

      const mockConsole = createMockConsole();
      const logger = createLogger("scope", undefined, mockConsole);

      logger.info("info msg");
      logger.warn("warn msg");

      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it("defaults to info level if global level is invalid", () => {
      (globalThis as { __FRANZAI_LOG_LEVEL__?: unknown }).__FRANZAI_LOG_LEVEL__ = "invalid";

      const mockConsole = createMockConsole();
      const logger = createLogger("scope", undefined, mockConsole);

      logger.debug("debug msg");
      logger.info("info msg");

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it("defaults to info level when no level specified", () => {
      const mockConsole = createMockConsole();
      const logger = createLogger("scope", undefined, mockConsole);

      logger.debug("debug msg");
      logger.info("info msg");

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
    });
  });
});
