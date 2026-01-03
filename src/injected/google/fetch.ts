import { BRIDGE_SOURCE, BRIDGE_TIMEOUT_MS } from "../../shared/constants";
import { isTextualResponse } from "../../shared/content-type";
import { PAGE_MSG } from "../../shared/messages";
import { makeId } from "../../shared/ids";
import { bodyToPayload } from "../body";
import { ensureDomainStatus, getCachedDomainEnabledValue } from "../domain-status";

const BRIDGE_DISABLED_MESSAGE =
  "Bridge is disabled for this domain. Enable it in the extension or add <meta name=\"franzai-bridge\" content=\"enabled\"> to your page.";

function getHeaderValue(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

export async function googleFetch(
  url: string,
  init: RequestInit | undefined,
  ensureDomainEnabled: () => Promise<boolean>
): Promise<Response> {
  const domainEnabled = getCachedDomainEnabledValue();
  if (domainEnabled === null) await ensureDomainStatus();
  if (!(await ensureDomainEnabled())) {
    throw new Error(BRIDGE_DISABLED_MESSAGE);
  }

  const requestId = makeId("gfetch");
  const liteInit = init ? {
    method: init.method,
    headers: init.headers,
    body: init.body ? await bodyToPayload(init.body as BodyInit, new Headers(init.headers)) : undefined
  } : undefined;

  const req = { requestId, url, init: liteInit };

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Google fetch timed out"));
    }, BRIDGE_TIMEOUT_MS);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const data = ev.data as { source?: string; type?: string; payload?: { requestId: string; ok: boolean; status: number; statusText: string; headers: Record<string, string>; bodyText: string; bodyBytes?: Uint8Array; error?: string } };
      if (!data || data.source !== BRIDGE_SOURCE || data.type !== PAGE_MSG.GOOGLE_FETCH_RESPONSE) return;
      if (data.payload?.requestId !== requestId) return;

      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);

      const resp = data.payload;
      if (!resp.ok && resp.error) {
        reject(new Error(resp.error));
        return;
      }

      const contentType = getHeaderValue(resp.headers, "content-type");
      const useText = isTextualResponse(contentType);

      if (!useText && resp.bodyBytes) {
        resolve(new Response(resp.bodyBytes as BodyInit, {
          status: resp.status,
          statusText: resp.statusText,
          headers: resp.headers
        }));
        return;
      }

      if (!useText && !resp.bodyBytes) {
        console.warn("[FranzAI Bridge] Binary Google response missing body bytes; falling back to text.");
      }

      resolve(new Response(resp.bodyText, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers
      }));
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: BRIDGE_SOURCE, type: PAGE_MSG.GOOGLE_FETCH_REQUEST, payload: req }, "*");
  });
}
