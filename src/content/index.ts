import { initMetaTagReporting } from "./meta-tag";
import { registerBackgroundPort } from "./ports";
import { registerPageRouter } from "./page-router";
import { sendInitialDomainStatus } from "./domain-status";
import { createLogger } from "../shared/logger";

const log = createLogger("content");

export function initContentScript(): void {
  registerBackgroundPort();
  registerPageRouter();

  // Meta tag must be reported BEFORE we send domain status
  // Otherwise status will show disabled even when meta tag exists
  initMetaTagReporting()
    .then(() => sendInitialDomainStatus())
    .catch((e) => {
      log.warn("Failed to initialize domain status", e);
    });
}
