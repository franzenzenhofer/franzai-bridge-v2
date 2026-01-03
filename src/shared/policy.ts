import type { Dict, InjectionRule } from "./types";
import { expandTemplate, hasHeader } from "./providers";
import { matchesAnyPattern, wildcardToRegExp } from "./wildcard";

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return matchesAnyPattern(origin, allowedOrigins);
}

export function isDestinationAllowed(url: URL, allowedDestinations: string[]): boolean {
  const full = url.toString();
  const host = url.hostname;

  for (const pat of allowedDestinations) {
    const p = pat.trim();
    if (!p) continue;
    if (p.includes("://")) {
      if (wildcardToRegExp(p).test(full)) return true;
    } else if (wildcardToRegExp(p).test(host)) {
      return true;
    }
  }
  return false;
}

export function applyInjectionRules(args: {
  url: URL;
  headers: Dict<string>;
  env: Dict<string>;
  rules: InjectionRule[];
}): void {
  const { url, headers, env, rules } = args;

  for (const rule of rules) {
    const hostRe = wildcardToRegExp(rule.hostPattern);
    if (!hostRe.test(url.hostname)) continue;

    if (rule.injectHeaders) {
      for (const [hk, hvTemplate] of Object.entries(rule.injectHeaders)) {
        if (hasHeader(headers, hk)) continue;
        const value = expandTemplate(hvTemplate, env).trim();
        if (value) headers[hk] = value;
      }
    }

    if (rule.injectQuery) {
      for (const [qk, qvTemplate] of Object.entries(rule.injectQuery)) {
        if (url.searchParams.has(qk)) continue;
        const value = expandTemplate(qvTemplate, env).trim();
        if (value) url.searchParams.set(qk, value);
      }
    }
  }
}
