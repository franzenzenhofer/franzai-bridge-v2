import { initMetaTagReporting } from "./meta-tag";
import { registerBackgroundPort } from "./ports";
import { registerPageRouter } from "./page-router";
import { sendInitialDomainStatus } from "./domain-status";
import { createLogger } from "../shared/logger";

const log = createLogger("content");

export function initContentScript(): void {
  registerBackgroundPort();
  initMetaTagReporting();
  registerPageRouter();

  sendInitialDomainStatus().catch((e) => {
    log.warn("Failed to send initial domain status", e);
  });
}
