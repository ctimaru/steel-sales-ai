import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const sql = readFileSync(join(root, "../../supabase/migrations/20261106150000_rfqc1_email1d_atomic_inbound_receipts.sql"), "utf8");
const existingWebhook = readFileSync(join(root, "app/api/webhooks/resend/route.ts"), "utf8");
const aliasSource = readFileSync(join(root, "lib/rfqc1-inbound-email.ts"), "utf8");

test("EMAIL1.D exact-once by provider email (not event): one atomic SQL function", () => {
  assert.match(sql, /unique \(provider, provider_email_id\)/i);
  assert.match(sql, /unique \(provider, provider_event_id\)/i);
  assert.match(sql, /on conflict \(provider, provider_email_id\) do nothing/i);
  const receipt = sql.indexOf("insert into public.buyer_rfq_inbound_email_receipts(");
  const message = sql.indexOf("insert into public.buyer_rfq_negotiation_messages(");
  const link = sql.indexOf("set message_id = v_message.id");
  assert.ok(receipt > 0 && message > receipt && link > message);
  assert.match(sql, /'supplier', 'message', v_thread\.round_no/);
  assert.match(sql, /'not_required'/);
});

test("EMAIL1.D refuses sender forgery, inactive campaigns, cross-tenant delivery and flood", () => {
  assert.match(sql, /p_sender_authenticated is distinct from true/);
  assert.match(sql, /supplier_email_normalized = v_sender/);
  assert.match(sql, /v_dispatch\.organization_id/);
  assert.match(sql, /v_dispatch\.owner_user_id/);
  assert.match(sql, /status not in \('queued','sending','cancelled','failed'/);
  assert.match(sql, /status not in \('draft','queued','cancelled','failed'/);
  assert.match(sql, /status not in \('launched','collecting'\)/);
  assert.match(sql, /created_at >= now\(\) - interval '1 hour'/);
  assert.match(sql, />= 10 then/);
  assert.match(sql, /char_length\(v_body\) not between 1 and 4000/);
});

test("EMAIL1.D internal ledger has no anonymous row grants or client RLS access", () => {
  assert.match(sql, /alter table public\.buyer_rfq_inbound_email_receipts enable row level security/);
  assert.match(sql, /revoke all on public\.buyer_rfq_inbound_email_receipts\s+from public, anon, authenticated, service_role/);
  assert.doesNotMatch(sql, /create policy/i);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /security invoker\s+set search_path = ''/);
  assert.match(sql, /revoke all on function public\.rfqc1_ingest_received_email/);
  assert.match(sql, /grant execute on function public\.rfqc1_ingest_received_email\([\s\S]*?\) to anon/);
});

test("EMAIL1.D release gate remains closed with no active receiver, no provider send", () => {
  assert.doesNotMatch(existingWebhook, /"email\.received"/);
  assert.match(aliasSource, /RFQC1_INBOUND_ATOMIC_LEDGER_READY/);
  assert.match(aliasSource, /RFQC1_INBOUND_RECEIVER_READY/);
  assert.match(aliasSource, /RFQC1_INBOUND_EMAIL_ENABLED/);
  assert.ok(!sql.includes("resend.com/"));
});
