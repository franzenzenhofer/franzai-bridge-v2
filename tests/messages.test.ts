/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { BG_MSG, BG_EVT, PAGE_MSG } from "../src/shared/messages";

describe("messages", () => {
  describe("BG_MSG constants", () => {
    it("has FETCH message type", () => {
      expect(BG_MSG.FETCH).toBe("FRANZAI_FETCH");
    });

    it("has FETCH_ABORT message type", () => {
      expect(BG_MSG.FETCH_ABORT).toBe("FRANZAI_FETCH_ABORT");
    });

    it("has GET_SETTINGS message type", () => {
      expect(BG_MSG.GET_SETTINGS).toBe("FRANZAI_GET_SETTINGS");
    });

    it("has SET_SETTINGS message type", () => {
      expect(BG_MSG.SET_SETTINGS).toBe("FRANZAI_SET_SETTINGS");
    });

    it("has GET_LOGS message type", () => {
      expect(BG_MSG.GET_LOGS).toBe("FRANZAI_GET_LOGS");
    });

    it("has GET_KEY_NAMES message type", () => {
      expect(BG_MSG.GET_KEY_NAMES).toBe("FRANZAI_GET_KEY_NAMES");
    });

    it("has CLEAR_LOGS message type", () => {
      expect(BG_MSG.CLEAR_LOGS).toBe("FRANZAI_CLEAR_LOGS");
    });

    it("all message types are unique", () => {
      const values = Object.values(BG_MSG);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe("BG_EVT constants", () => {
    it("has LOGS_UPDATED event type", () => {
      expect(BG_EVT.LOGS_UPDATED).toBe("FRANZAI_LOGS_UPDATED");
    });

    it("has SETTINGS_UPDATED event type", () => {
      expect(BG_EVT.SETTINGS_UPDATED).toBe("FRANZAI_SETTINGS_UPDATED");
    });

    it("all event types are unique", () => {
      const values = Object.values(BG_EVT);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe("PAGE_MSG constants", () => {
    it("has FETCH_REQUEST message type", () => {
      expect(PAGE_MSG.FETCH_REQUEST).toBe("FETCH_REQUEST");
    });

    it("has FETCH_ABORT message type", () => {
      expect(PAGE_MSG.FETCH_ABORT).toBe("FETCH_ABORT");
    });

    it("has FETCH_RESPONSE message type", () => {
      expect(PAGE_MSG.FETCH_RESPONSE).toBe("FETCH_RESPONSE");
    });

    it("has BRIDGE_READY message type", () => {
      expect(PAGE_MSG.BRIDGE_READY).toBe("BRIDGE_READY");
    });

    it("has KEYS_REQUEST message type", () => {
      expect(PAGE_MSG.KEYS_REQUEST).toBe("KEYS_REQUEST");
    });

    it("has KEYS_RESPONSE message type", () => {
      expect(PAGE_MSG.KEYS_RESPONSE).toBe("KEYS_RESPONSE");
    });

    it("has KEYS_UPDATE message type", () => {
      expect(PAGE_MSG.KEYS_UPDATE).toBe("KEYS_UPDATE");
    });

    it("all message types are unique", () => {
      const values = Object.values(PAGE_MSG);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe("message type compatibility", () => {
    it("BG_MSG and BG_EVT have no overlapping values", () => {
      const bgMsgValues = new Set(Object.values(BG_MSG));
      const bgEvtValues = Object.values(BG_EVT);

      for (const evt of bgEvtValues) {
        expect(bgMsgValues.has(evt)).toBe(false);
      }
    });

    it("PAGE_MSG values are distinct from BG_MSG", () => {
      const bgMsgValues = new Set(Object.values(BG_MSG));
      const pageMsgValues = Object.values(PAGE_MSG);

      for (const msg of pageMsgValues) {
        expect(bgMsgValues.has(msg)).toBe(false);
      }
    });
  });
});
