type DomainResolutionInput = {
  hostname?: string;
  topHostname?: string;
  ancestorOrigin?: string;
  referrer?: string;
};

function normalizeHostname(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function hostnameFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return normalizeHostname(new URL(url).hostname);
  } catch {
    return "";
  }
}

export function resolveDomain(input: DomainResolutionInput): string {
  const direct = normalizeHostname(input.hostname);
  if (direct) return direct;

  const topHost = normalizeHostname(input.topHostname);
  if (topHost) return topHost;

  const ancestorHost = hostnameFromUrl(input.ancestorOrigin);
  if (ancestorHost) return ancestorHost;

  const referrerHost = hostnameFromUrl(input.referrer);
  if (referrerHost) return referrerHost;

  return "";
}

function readTopHostname(): string {
  try {
    if (window.top && window.top !== window) {
      return window.top.location.hostname ?? "";
    }
  } catch {
    // Cross-origin top access may throw.
  }
  return "";
}

function readAncestorOrigin(): string {
  try {
    const origins = window.location.ancestorOrigins;
    if (origins && origins.length > 0) {
      return origins[0] ?? "";
    }
  } catch {
    // Ignore unsupported browsers.
  }
  return "";
}

export function resolveCurrentDomain(): string {
  return resolveDomain({
    hostname: window.location.hostname,
    topHostname: readTopHostname(),
    ancestorOrigin: readAncestorOrigin(),
    referrer: document.referrer
  });
}
