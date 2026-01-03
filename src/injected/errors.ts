export function createAbortError(message: string) {
  try {
    return new DOMException(message, "AbortError");
  } catch {
    const err = new Error(message) as Error & { name?: string };
    err.name = "AbortError";
    return err;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
