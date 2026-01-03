const inFlight = new Map<string, AbortController>();
const abortedByPage = new Set<string>();

export function trackInFlight(requestId: string, controller: AbortController): void {
  inFlight.set(requestId, controller);
}

export function clearInFlight(requestId: string): void {
  inFlight.delete(requestId);
  abortedByPage.delete(requestId);
}

export function abortFetch(requestId: string): void {
  abortedByPage.add(requestId);
  const controller = inFlight.get(requestId);
  if (controller) controller.abort();
}

export function wasAbortedByPage(requestId: string): boolean {
  return abortedByPage.has(requestId);
}
