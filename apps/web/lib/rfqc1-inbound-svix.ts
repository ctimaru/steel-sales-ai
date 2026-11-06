/**
 * RFQC1.EMAIL1.E - independently verify a Resend/Svix signature over the RAW
 * request body. This is NOT sender authentication. Never use mail headers,
 * request IP, From, subject or unverified JSON to authorise an RFQ write.
 *
 * The current outbound delivery webhook is intentionally unchanged.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type Rfqc1SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export const RFQC1_MAX_WEBHOOK_BYTES = 32768;

export function verifyRfqc1InboundSvix(input: {
  rawPayload: string;
  headers: Rfqc1SvixHeaders;
  secret: string;
  nowSeconds?: number;
}): boolean {
  const { rawPayload, headers, secret } = input;
  if (Buffer.byteLength(rawPayload, "utf8") > RFQC1_MAX_WEBHOOK_BYTES ||
      !headers.id || !/^[A-Za-z0-9_\-]{1,200}$/.test(headers.id) ||
      !headers.timestamp || !/^\d{9,11}$/.test(headers.timestamp) ||
      !headers.signature || headers.signature.length > 1024) return false;

  const timestamp = Number(headers.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || !Number.isSafeInteger(now) ||
      Math.abs(now - timestamp) > 300) return false;

  const rawKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(rawKey)) return false;
  const key = Uint8Array.from(Buffer.from(rawKey, "base64"));
  if (key.length < 24) return false;

  const signed = headers.id + "." + headers.timestamp + "." + rawPayload;
  const expected = Uint8Array.from(createHmac("sha256", key).update(signed).digest());
  const candidates = headers.signature.split(" ").filter(Boolean);
  if (candidates.length === 0 || candidates.length > 8) return false;

  return candidates.some((candidate) => {
    const m = /^v1,([A-Za-z0-9+/]{43}=)$/.exec(candidate);
    if (!m) return false;
    const actual = Uint8Array.from(Buffer.from(m[1], "base64"));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

/** Receive body with a HARD byte limit, including if Content-Length is absent.
 * Never call req.json() before signature verification.
 */
export async function readRfqc1BoundedRawBody(
  body: ReadableStream<Uint8Array> | null,
  declaredLength: string | null,
): Promise<string | null> {
  if (!body || (declaredLength !== null &&
      (!/^\d+$/.test(declaredLength) || Number(declaredLength) > RFQC1_MAX_WEBHOOK_BYTES))) {
    return null;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > RFQC1_MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const part of chunks) {
      joined.set(part, offset);
      offset += part.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(joined);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
