import { describe, expect, it } from "vitest";
import type { LogEntry } from "../src/shared/types";
import {
  deriveLogLifecycle,
  getStatusDisplay,
  getStatusTitle
} from "../src/sidepanel/logs/stage";

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: "log-1",
    requestId: "req-1",
    ts: Date.now(),
    pageOrigin: "https://app.example.com",
    url: "https://api.example.com/v1/test",
    method: "GET",
    requestHeaders: {},
    requestBodyPreview: "",
    ...overrides
  };
}

describe("log lifecycle derivation", () => {
  it("maps pending requests to queued stage", () => {
    const lifecycle = deriveLogLifecycle(makeLog({ statusText: "Pending..." }));
    expect(lifecycle.stage).toBe("queued");
    expect(lifecycle.inFlight).toBe(true);
  });

  it("maps receiving status text to receiving stage", () => {
    const lifecycle = deriveLogLifecycle(
      makeLog({ status: 200, statusText: "Receiving response..." })
    );
    expect(lifecycle.stage).toBe("receiving");
    expect(getStatusDisplay(makeLog({ status: 200, statusText: "Receiving response..." }), lifecycle)).toBe("RECV");
  });

  it("maps streaming status text to streaming stage", () => {
    const lifecycle = deriveLogLifecycle(makeLog({ statusText: "Streaming..." }));
    expect(lifecycle.stage).toBe("streaming");
    expect(lifecycle.statusClass).toBe("pending");
  });

  it("maps timeout and aborted errors to specific failure stages", () => {
    const timeout = deriveLogLifecycle(
      makeLog({ statusText: "Timeout", error: "Timed out after 1000ms" })
    );
    const aborted = deriveLogLifecycle(
      makeLog({ statusText: "Aborted", error: "Aborted by caller" })
    );

    expect(timeout.stage).toBe("timeout");
    expect(aborted.stage).toBe("aborted");
  });

  it("maps status codes to terminal stages and display text", () => {
    const successLog = makeLog({ status: 200, statusText: "OK" });
    const success = deriveLogLifecycle(successLog);
    expect(success.stage).toBe("success");
    expect(getStatusDisplay(successLog, success)).toBe("200");
    expect(getStatusTitle(successLog, success)).toBe("200 OK");

    const redirect = deriveLogLifecycle(makeLog({ status: 302 }));
    expect(redirect.stage).toBe("redirect");

    const errorLog = makeLog({ status: 500, statusText: "Server Error" });
    const error = deriveLogLifecycle(errorLog);
    expect(error.stage).toBe("error");
    expect(getStatusDisplay(errorLog, error)).toBe("500");
  });
});
