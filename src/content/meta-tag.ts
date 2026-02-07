import { BG_MSG } from "../shared/messages";
import { createLogger } from "../shared/logger";
import { sendRuntimeMessage } from "../shared/runtime";
import { resolveCurrentDomain } from "./domain";

const log = createLogger("content-meta");

function detectMetaTag(): boolean {
  const meta = document.querySelector('meta[name="franzai-bridge"]');
  if (!meta) return false;
  const content = meta.getAttribute("content")?.toLowerCase();
  return content === "enabled" || content === "enabled-by-default" || content === "true";
}

async function reportMetaTag(): Promise<boolean> {
  const domain = resolveCurrentDomain();
  const enabled = detectMetaTag();

  if (!enabled || !domain) return false;
  log.info("Meta tag detected, reporting to background:", domain);
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.REPORT_META_TAG; payload: { domain: string; enabled: boolean } },
      { ok: boolean }
    >({
      type: BG_MSG.REPORT_META_TAG,
      payload: { domain, enabled: true }
    });
    return resp.ok;
  } catch (e) {
    log.warn("Failed to report meta tag", e);
    return false;
  }
}

export async function initMetaTagReporting(): Promise<boolean> {
  if (document.readyState === "loading") {
    return new Promise<boolean>((resolve) => {
      document.addEventListener("DOMContentLoaded", () => {
        reportMetaTag().then(resolve).catch(() => resolve(false));
      });
    });
  } else {
    return reportMetaTag();
  }
}
