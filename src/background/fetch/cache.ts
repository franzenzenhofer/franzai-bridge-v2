import type { FetchResponseToPage } from "../../shared/types";

export type CacheEntry = {
  response: FetchResponseToPage;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedResponse(key: string): FetchResponseToPage | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCachedResponse(key: string, response: FetchResponseToPage, ttlMs: number): void {
  cache.set(key, { response, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  cache.clear();
}
