import { BG_MSG } from "../shared/messages";
import { createLogger } from "../shared/logger";
import { sendRuntimeMessage } from "../shared/runtime";

const log = createLogger("content-meta");

function detectMetaTag(): boolean {
  const meta = document.querySelector('meta[name="franzai-bridge"]');
  if (!meta) return false;
  const content = meta.getAttribute("content")?.toLowerCase();
  return content === "enabled" || content === "enabled-by-default" || content === "true";
}

async function reportMetaTag(): Promise<void> {
  const domain = window.location.hostname;
  const enabled = detectMetaTag();

  if (!enabled) return;
  log.info("Meta tag detected, reporting to background:", domain);
  try {
    await sendRuntimeMessage({
      type: BG_MSG.REPORT_META_TAG,
      payload: { domain, enabled: true }
    });
  } catch (e) {
    log.warn("Failed to report meta tag", e);
  }
}

export function initMetaTagReporting(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void reportMetaTag());
  } else {
    void reportMetaTag();
  }
}
