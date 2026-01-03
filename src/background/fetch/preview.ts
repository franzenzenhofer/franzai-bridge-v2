import type { BinaryBody } from "../../shared/types";
import { isBinaryBody } from "./body";

export function previewBody(body: unknown, max: number): string {
  if (body == null) return "";
  if (isBinaryBody(body)) return `[binary body ${body.byteLength} bytes]`;
  if (body instanceof Uint8Array) return `[binary body ${body.byteLength} bytes]`;
  if (body instanceof ArrayBuffer) return `[binary body ${body.byteLength} bytes]`;
  if (typeof body !== "string") return `[${typeof body} body omitted]`;
  if (body.length <= max) return body;
  return body.slice(0, max) + `\n\n...[truncated, total ${body.length} chars]`;
}
