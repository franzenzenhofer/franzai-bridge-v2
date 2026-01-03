export function isTextualResponse(contentType?: string | null): boolean {
  if (!contentType) return true;
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith("text/") ||
    ct.includes("json") ||
    ct.includes("xml") ||
    ct.includes("javascript") ||
    ct.includes("x-www-form-urlencoded")
  );
}

export function isEventStream(contentType?: string | null): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().includes("text/event-stream");
}
