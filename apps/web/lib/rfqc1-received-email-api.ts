/**
 * RFQC1.EMAIL1.C — read-only Resend Received Email API adapter.
 *
 * This helper is NOT called by a webhook, never writes to Supabase and
 * never sends mail. Only supply a server-side API key AFTER a verified
 * email.received event and an approved receiving/ledger implementation.
 * In tests inject request() and use synthetic responses; no external API.
 */
const receivedEmailId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_JSON_RESPONSE_BYTES = 262144;

/** The provider's payload is untrusted until inspectRfqc1ReceivedContent().
 * Do not infer SPF/DKIM/DMARC pass from arbitrary received headers.
 */
export async function fetchRfqc1ReceivedEmailReadOnly(input: {
  providerEmailId: string;
  apiKey: string;
  request: typeof fetch;
}): Promise<unknown> {
  if (!receivedEmailId.test(input.providerEmailId))
    throw new Error("RFQC1 email identifier invalid");
  if (typeof input.apiKey !== "string" || input.apiKey.length < 8)
    throw new Error("RFQC1 server-side provider key missing");
  const response = await input.request(
    "https://api.resend.com/emails/receiving/" + encodeURIComponent(input.providerEmailId),
    {
      method: "GET",
      headers: {
        Authorization: "Bearer " + input.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error("RFQC1 provider read failed");
  const mime = response.headers.get("content-type") ?? "";
  if (!mime.toLowerCase().includes("application/json"))
    throw new Error("RFQC1 provider response type invalid");
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_JSON_RESPONSE_BYTES)
    throw new Error("RFQC1 provider response oversized");
  // Never log either the response or untrusted email text.
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_JSON_RESPONSE_BYTES)
    throw new Error("RFQC1 provider response oversized");
  try {
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("RFQC1 provider response shape invalid");
    return data;
  } catch {
    throw new Error("RFQC1 provider response invalid");
  }
}
