// Google OAuth scopes for FranzAI Bridge
// V1 supports: Search Console (webmasters) and Analytics

export const V1_SCOPES = {
  WEBMASTERS: "https://www.googleapis.com/auth/webmasters",
  WEBMASTERS_READONLY: "https://www.googleapis.com/auth/webmasters.readonly",
  ANALYTICS_READONLY: "https://www.googleapis.com/auth/analytics.readonly",
  ANALYTICS: "https://www.googleapis.com/auth/analytics"
} as const;

export const SCOPE_ALIASES: Record<string, string> = {
  "webmasters": V1_SCOPES.WEBMASTERS,
  "webmasters.readonly": V1_SCOPES.WEBMASTERS_READONLY,
  "searchconsole": V1_SCOPES.WEBMASTERS_READONLY,
  "search-console": V1_SCOPES.WEBMASTERS_READONLY,
  "analytics": V1_SCOPES.ANALYTICS,
  "analytics.readonly": V1_SCOPES.ANALYTICS_READONLY
};

const ALL_VALID_SCOPES = new Set<string>(Object.values(V1_SCOPES));

export function isValidScope(scope: string): boolean {
  return ALL_VALID_SCOPES.has(scope) || scope in SCOPE_ALIASES;
}

export function normalizeScope(scope: string): string {
  const trimmed = scope.trim().toLowerCase();
  return SCOPE_ALIASES[trimmed] ?? scope;
}

export function normalizeScopeInput(input: string | string[] | undefined): string[] {
  if (!input) {
    return [V1_SCOPES.WEBMASTERS_READONLY];
  }
  const arr = Array.isArray(input) ? input : [input];
  return arr.map(normalizeScope);
}

export function scopesInclude(granted: string[], required: string[]): boolean {
  const grantedSet = new Set(granted);
  return required.every(s => grantedSet.has(s));
}
