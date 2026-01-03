import type { BinaryBody } from "../../shared/types";
import { base64ToUint8Array } from "../../shared/base64";

export function isBinaryBody(body: unknown): body is BinaryBody {
  return typeof body === "object" && body !== null && "__binary" in body && (body as BinaryBody).__binary === true;
}

export function decodeBinaryBody(body: BinaryBody): Uint8Array {
  return base64ToUint8Array(body.base64);
}
