import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySvixSignature(input: {
  payload: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
}) {
  if (!input.id || !input.timestamp || !input.signature) return false;

  const timestampSeconds = Number(input.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > 300) return false;

  const rawSecret = input.secret.startsWith("whsec_")
    ? input.secret.slice("whsec_".length)
    : input.secret;

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(rawSecret, "base64");
  } catch {
    return false;
  }

  const expected = createHmac("sha256", secretBytes)
    .update(input.id + "." + input.timestamp + "." + input.payload)
    .digest();

  const candidates = input.signature
    .split(" ")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const [version, signature] = value.split(",", 2);
      return version === "v1" && signature ? signature : null;
    })
    .filter((value): value is string => Boolean(value));

  return candidates.some((candidate) => {
    try {
      const actual = Buffer.from(candidate, "base64");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const dbSecret = process.env.RFQ_WEBHOOK_DB_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!webhookSecret || !dbSecret || !supabaseUrl || !publishableKey) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const payloadText = await request.text();
  const verified = verifySvixSignature({
    payload: payloadText,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret: webhookSecret,
  });

  if (!verified) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let payload: {
    type?: string;
    data?: { email_id?: string; id?: string };
  };

  try {
    payload = JSON.parse(payloadText) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = payload.type?.trim() || "";
  const providerMessageId =
    payload.data?.email_id?.trim() || payload.data?.id?.trim() || null;
  const eventId = request.headers.get("svix-id") || "";

  const trackedEvents = new Set([
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.complained",
  ]);

  if (!trackedEvents.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = createSupabaseClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.rpc("rfqh3_ingest_resend_event", {
    p_db_secret: dbSecret,
    p_event_id: eventId,
    p_event_type: eventType,
    p_provider_message_id: providerMessageId,
    p_payload: payload,
  });

  if (error) {
    console.error("RFQH3 Resend webhook ingest failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
