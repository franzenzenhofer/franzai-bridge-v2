export function getHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function getOriginHostname(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}
