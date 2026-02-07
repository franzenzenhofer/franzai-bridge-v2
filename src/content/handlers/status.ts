import { PAGE_MSG } from "../../shared/messages";
import { BRIDGE_SOURCE } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { fetchDomainStatus, makeFallbackStatus } from "../domain-status";
import { resolveCurrentDomain } from "../domain";

const log = createLogger("content-status");

export async function handleStatusRequest(statusId: string): Promise<void> {
  if (!statusId) return;

  const domain = resolveCurrentDomain();
  if (!domain) {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.STATUS_RESPONSE,
      payload: { statusId, status: makeFallbackStatus("Unable to resolve current domain") }
    }, "*");
    return;
  }

  try {
    const status = await fetchDomainStatus(domain);
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.STATUS_RESPONSE,
      payload: { statusId, status }
    }, "*");
  } catch (e) {
    log.warn("Failed to get status", e);
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.STATUS_RESPONSE,
      payload: { statusId, status: makeFallbackStatus("Failed to get status from extension") }
    }, "*");
  }
}
