/**
 * RFQC1.EMAIL1.E — dedicated INBOUND webhook (distinct from RFQH3 delivery).
 *
 * This handler is deliberately non-operational until a future trusted
 * sender-authentication provider is integrated and explicitly signed off.
 * No provider settings, DNS, database migration or flags are activated here.
 * Signed Svix webhook != authenticated SMTP From.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  RFQC1_MAX_WEBHOOK_BYTES,
  readRfqc1BoundedRawBody,
  verifyRfqc1InboundSvix,
} from "@/lib/rfqc1-inbound-svix";
import {
  evaluateRfqc1InboundReply,
  type Rfqc1InboundDispatch,
} from "@/lib/rfqc1-inbound-email";
import {
  inspectRfqc1ReceivedContent,
  parseRfqc1ReceivedWebhook,
} from "@/lib/rfqc1-received-email-preflight";
import { fetchRfqc1ReceivedEmailReadOnly } from "@/lib/rfqc1-received-email-api";
import {
  isRfqc1SenderAuthenticated,
  isRfqc1TrustedSenderVerifierAvailable,
} from "@/lib/rfqc1-inbound-transport-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json(
    { ok: false },
    { status: 503, headers: { "Retry-After": "300", "Cache-Control": "no-store" } },
  );
}

function ignored() {
  return NextResponse.json({ ok: true, ignored: true }, {
    status: 200, headers: { "Cache-Control": "no-store" },
  });
}

function verifiedDispatch(value: unknown, dispatchId: string): Rfqc1InboundDispatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (obj.valid !== true || typeof obj.rfqId !== "string" ||
      typeof obj.dispatchId !== "string" ||
      typeof obj.supplierId !== "string" ||
      typeof obj.supplierEmail !== "string" ||
      !uuid.test(obj.rfqId) || !uuid.test(obj.dispatchId) ||
      !uuid.test(obj.supplierId) ||
      obj.dispatchId.toLowerCase() !== dispatchId ||
      obj.supplierEmail.length > 320) return null;
  return {
    rfqId: obj.rfqId,
    dispatchId: obj.dispatchId,
    supplierId: obj.supplierId,
    supplierEmail: obj.supplierEmail,
  };
}

export async function POST(request: NextRequest) {
  // These are SERVER-ONLY values. The actual attestation implementation is
  // deliberately unavailable today, so flags alone can NEVER activate this.
  if (process.env.RFQC1_INBOUND_EMAIL_ENABLED !== "true" ||
      process.env.RFQC1_INBOUND_RECEIVER_READY !== "true" ||
      process.env.RFQC1_INBOUND_ATOMIC_LEDGER_READY !== "true" ||
      process.env.RFQC1_INBOUND_TRUSTED_SENDER_PROOF_READY !== "true" ||
      !isRfqc1TrustedSenderVerifierAvailable()) {
    return unavailable();
  }

  const webhookSecret = process.env.RFQC1_INBOUND_WEBHOOK_SECRET;
  const receivingDomain = process.env.RFQC1_INBOUND_DOMAIN;
  const signingSecret = process.env.RFQC1_INBOUND_SIGNING_SECRET;
  const dbSecret = process.env.RFQ_WEBHOOK_DB_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!webhookSecret || !receivingDomain || !signingSecret ||
      !dbSecret || !resendApiKey || !supabaseUrl || !supabaseKey) return unavailable();

  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
      "application/json") {
    return NextResponse.json({ ok: false }, { status: 415 });
  }
  const raw = await readRfqc1BoundedRawBody(
    request.body, request.headers.get("content-length"),
  );
  if (!raw || Buffer.byteLength(raw, "utf8") > RFQC1_MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const eventId = request.headers.get("svix-id");
  if (!verifyRfqc1InboundSvix({
    rawPayload: raw,
    headers: {
      id: eventId,
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    secret: webhookSecret,
  })) return NextResponse.json({ ok: false }, { status: 400 });

  let payload: unknown;
  try { payload = JSON.parse(raw) as unknown; }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const envelope = parseRfqc1ReceivedWebhook(payload, receivingDomain);
  if (envelope.kind !== "candidate") return ignored();

  const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: lookup, error: lookupError } = await supabase.rpc(
    "rfqc1_received_dispatch_context",
    { p_db_secret: dbSecret, p_dispatch_id: envelope.dispatchId },
  );
  if (lookupError) return unavailable();

  const identity = verifiedDispatch(lookup, envelope.dispatchId);
  if (!identity) return ignored();

  // Check signed alias and exact expected supplier BEFORE fetching any mail
  // body. The signature and UUID are correlation hints, not a login.
  const early = evaluateRfqc1InboundReply({
    identity,
    receivingDomain,
    signingSecret,
    reply: {
      providerEmailId: envelope.providerEmailId,
      from: envelope.from,
      envelopeTo: [envelope.recipient],
      plainText: ".",
      senderAuthenticationPassed: false,
    },
  });
  if (early.kind !== "quarantine") return ignored();

  let received: unknown;
  try {
    received = await fetchRfqc1ReceivedEmailReadOnly({
      providerEmailId: envelope.providerEmailId,
      apiKey: resendApiKey,
      request: fetch,
    });
  } catch {
    // A transient provider read failure should be retried, never accepted.
    return unavailable();
  }
  const content = inspectRfqc1ReceivedContent(envelope, received);
  if (content.kind !== "candidate") return ignored();

  // FAIL CLOSED: the API's From / headers cannot prove SMTP identity.
  // No verified transport source currently exists. Respond 503 for retry,
  // rather than falsely claiming to have durably quarantined the message.
  const senderAuthenticationPassed = isRfqc1SenderAuthenticated(received);
  if (!senderAuthenticationPassed) return unavailable();

  const decision = evaluateRfqc1InboundReply({
    identity, receivingDomain, signingSecret,
    reply: {
      providerEmailId: content.providerEmailId,
      from: content.from,
      envelopeTo: [content.recipient],
      plainText: content.plainText,
      senderAuthenticationPassed,
    },
  });
  if (decision.kind !== "eligible") return ignored();

  // Only this guarded path can append a normal supplier text message. The
  // EMAIL1.D RPC enforces the UNIQUE provider-email receipt + RFQH6 append
  // in ONE transaction and rechecks tenant, supplier and dispatch.
  const { data: outcome, error: ingestError } = await supabase.rpc(
    "rfqc1_ingest_received_email",
    {
      p_db_secret: dbSecret,
      p_provider_event_id: eventId,
      p_provider_email_id: content.providerEmailId,
      p_dispatch_id: identity.dispatchId,
      p_sender_email: content.from,
      p_sender_authenticated: true,
      p_body: decision.body,
    },
  );
  if (ingestError || !outcome || outcome.ok !== true) return unavailable();

  return NextResponse.json({
    ok: true, duplicate: outcome.duplicate === true,
  }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
