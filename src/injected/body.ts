import { MAX_BODY_BYTES } from "../shared/constants";
import { uint8ArrayToBase64 } from "../shared/base64";

const textEncoder = new TextEncoder();

export function enforceMaxBytes(bytes: number): void {
  if (bytes > MAX_BODY_BYTES) {
    throw new Error(`Request body too large (${bytes} bytes). Max is ${MAX_BODY_BYTES} bytes.`);
  }
}

function byteLengthOfString(text: string): number {
  return textEncoder.encode(text).byteLength;
}

function isTextualContentType(contentType?: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith("text/") ||
    ct.includes("json") ||
    ct.includes("xml") ||
    ct.includes("x-www-form-urlencoded")
  );
}

function maybeSetContentType(headers: Headers, value: string | null | undefined) {
  if (!value) return;
  if (!headers.has("content-type")) headers.set("content-type", value);
}

function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer);
  enforceMaxBytes(bytes.byteLength);
  return bytes;
}

function toBinaryBody(bytes: Uint8Array): { __binary: true; base64: string; byteLength: number } {
  return {
    __binary: true,
    base64: uint8ArrayToBase64(bytes),
    byteLength: bytes.byteLength
  };
}

export async function bodyToPayload(
  body: BodyInit,
  headers: Headers
): Promise<string | { __binary: true; base64: string; byteLength: number }> {
  if (typeof body === "string") {
    enforceMaxBytes(byteLengthOfString(body));
    return body;
  }

  if (body instanceof URLSearchParams) {
    const text = body.toString();
    maybeSetContentType(headers, "application/x-www-form-urlencoded;charset=UTF-8");
    enforceMaxBytes(byteLengthOfString(text));
    return text;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const response = new Response(body);
    maybeSetContentType(headers, response.headers.get("content-type"));
    return toBinaryBody(toUint8Array(await response.arrayBuffer()));
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    if (isTextualContentType(body.type)) {
      const text = await body.text();
      maybeSetContentType(headers, body.type);
      enforceMaxBytes(byteLengthOfString(text));
      return text;
    }

    maybeSetContentType(headers, body.type);
    return toBinaryBody(toUint8Array(await body.arrayBuffer()));
  }

  if (body instanceof ArrayBuffer) {
    return toBinaryBody(toUint8Array(body));
  }

  if (ArrayBuffer.isView(body)) {
    const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    enforceMaxBytes(bytes.byteLength);
    return toBinaryBody(bytes);
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    const response = new Response(body);
    return toBinaryBody(toUint8Array(await response.arrayBuffer()));
  }

  throw new Error("FranzAI Bridge cannot forward this body type");
}

export async function readRequestBody(
  request: Request,
  headers: Headers
): Promise<string | { __binary: true; base64: string; byteLength: number } | undefined> {
  if (!request.body) return undefined;

  const contentType = headers.get("content-type");
  if (isTextualContentType(contentType)) {
    try {
      const text = await request.clone().text();
      enforceMaxBytes(byteLengthOfString(text));
      return text;
    } catch {
      // Fall back to bytes.
    }
  }

  try {
    return toBinaryBody(toUint8Array(await request.clone().arrayBuffer()));
  } catch {
    throw new Error("FranzAI Bridge cannot forward a locked or unreadable request body");
  }
}
