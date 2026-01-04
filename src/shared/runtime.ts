import { RUNTIME_MESSAGE_TIMEOUT_MS } from "./constants";
import { createLogger } from "./logger";

const log = createLogger("runtime");

type SendOptions = {
  timeoutMs?: number;
};

export function sendRuntimeMessage<TReq, TRes>(
  message: TReq,
  options: SendOptions = {}
): Promise<TRes> {
  const timeoutMs = options.timeoutMs ?? RUNTIME_MESSAGE_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let done = false;
    const timeoutId = window.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`Timeout waiting for runtime response after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (resp: TRes) => {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);

        const err = chrome.runtime.lastError;
        if (err) {
          const msg = err.message || "Unknown chrome runtime error";
          log.warn("sendMessage failed", msg);
          reject(new Error(msg));
          return;
        }

        resolve(resp);
      });
    } catch (e) {
      if (done) return;
      done = true;
      clearTimeout(timeoutId);
      log.error("sendMessage threw", e);
      reject(e);
    }
  });
}
