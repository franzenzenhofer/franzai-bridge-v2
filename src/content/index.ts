import { initMetaTagReporting } from "./meta-tag";
import { registerBackgroundPort } from "./ports";
import { registerPageRouter } from "./page-router";
import { sendInitialDomainStatus, sendDomainEnabledUpdate } from "./domain-status";
import { createLogger } from "../shared/logger";

const log = createLogger("content");

export function initContentScript(): void {
  registerBackgroundPort();
  registerPageRouter();

  // Meta tag must be reported BEFORE we send domain status
  // If meta tag was detected and reported, send enabled=true immediately
  // Otherwise fetch the status from background
  initMetaTagReporting()
    .then((metaTagEnabled) => {
      if (metaTagEnabled) {
        // Meta tag detected and reported - send enabled status directly
        log.info("Meta tag enabled domain, sending update");
        sendDomainEnabledUpdate(true, "meta");
      } else {
        // No meta tag - fetch status from background
        return sendInitialDomainStatus();
      }
    })
    .catch((e) => {
      log.warn("Failed to initialize domain status", e);
    });
}
