import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const foundation = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006122102_rfqh6_clarifications_revisions_negotiation.sql", import.meta.url),
  "utf8",
);
const deliveryLedger = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006122859_rfqh6_negotiation_delivery_ledger.sql", import.meta.url),
  "utf8",
);
const supplierNotification = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006123025_rfqh6_supplier_buyer_notification_context.sql", import.meta.url),
  "utf8",
);
const buyerPanel = fs.readFileSync(
  new URL("../components/rfq-buyer-negotiation-panel.tsx", import.meta.url),
  "utf8",
);
const supplierPanel = fs.readFileSync(
  new URL("../components/rfq-supplier-negotiation.tsx", import.meta.url),
  "utf8",
);
const buyerActions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/negotiation-actions.ts", import.meta.url),
  "utf8",
);
const supplierActions = fs.readFileSync(
  new URL("../app/(public)/rfq/respond/[token]/actions.ts", import.meta.url),
  "utf8",
);
const supplierPage = fs.readFileSync(
  new URL("../app/(public)/rfq/respond/[token]/page.tsx", import.meta.url),
  "utf8",
);
const buyerPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);
const emailLib = fs.readFileSync(
  new URL("../lib/rfqh6-negotiation.ts", import.meta.url),
  "utf8",
);

test("RFQH6 stores isolated negotiation threads, messages and explicit counter targets", () => {
  assert.match(foundation, /create table if not exists public\.buyer_rfq_negotiation_threads/);
  assert.match(foundation, /unique\(dispatch_id\)/);
  assert.match(foundation, /create table if not exists public\.buyer_rfq_negotiation_messages/);
  assert.match(foundation, /sender_role in\('buyer','supplier','system'\)/);
  assert.match(foundation, /create table if not exists public\.buyer_rfq_negotiation_targets/);
  assert.match(foundation, /unique\(message_id,rfq_line_id\)/);
});

test("RFQH6 direct table access stays buyer-owned while supplier access is capability-scoped", () => {
  assert.match(foundation, /enable row level security/);
  assert.match(foundation, /revoke all on public\.buyer_rfq_negotiation_threads from anon,authenticated/);
  assert.match(foundation, /owner_user_id=\(select auth\.uid\(\)\)/);
  assert.match(foundation, /rfqh_secure\.rfqh6_supplier_thread_impl/);
  assert.match(foundation, /rfqh_secure\.rfqh6_supplier_post_impl/);
  assert.match(foundation, /where d\.token_hash=p_token_hash/);
  assert.match(foundation, /security invoker/);
});

test("RFQH6 supports clarification, revision, counter-target and BAFO with explicit deadline governance", () => {
  for (const token of [
    "clarification",
    "revision_request",
    "counter_target",
    "bafo_request",
  ]) {
    assert.match(foundation, new RegExp(token));
  }
  assert.match(foundation, /BAFO deadline is required/);
  assert.match(foundation, /Negotiation deadline must be in the future/);
  assert.match(foundation, /Counter target requires at least one line/);
  assert.match(buyerPanel, /Best &amp; Final Offer/);
  assert.match(buyerPanel, /Counter target/);
  assert.match(buyerPanel, /Richiedi revisione/);
  assert.match(buyerPanel, /Chiarimento/);
});

test("RFQH6 only exposes counter targets explicitly shared for the selected supplier", () => {
  assert.match(foundation, /p_message_type not in\('counter_target','bafo_request'\)/);
  assert.match(foundation, /normalized_eur_t/);
  assert.match(foundation, /normalized_eur_m/);
  assert.match(supplierPanel, /Counter target condiviso/);
  assert.match(buyerPanel, /Target originario della distinta resta privato/);
  assert.doesNotMatch(supplierPanel, /target_eur_t|target_eur_m|target_total_eur/);
});

test("RFQH6 reminder governance enforces 24h cooldown and max two per active request", () => {
  assert.match(foundation, /reminder_count>=2/);
  assert.match(foundation, /interval '24 hours'/);
  assert.match(foundation, /Negotiation reminder cooldown not reached/);
  assert.match(foundation, /reminder_count=reminder_count\+1/);
  assert.match(buyerPanel, /Promemoria/);
  assert.match(buyerPanel, /reminder_count/);
});

test("RFQH6 BAFO and revision submissions synchronize the thread automatically", () => {
  assert.match(foundation, /rfqh6_quote_submission_sync/);
  assert.match(foundation, /bafo_received/);
  assert.match(foundation, /negotiation_bafo_received/);
  assert.match(foundation, /negotiation_revision_received/);
  assert.match(supplierPanel, /Apri revisione BAFO/);
  assert.match(supplierPanel, /startSupplierQuoteRevision/);
});

test("RFQH6 buyer and supplier surfaces both use the private thread", () => {
  assert.match(buyerPage, /buyer_rfq_negotiation_threads/);
  assert.match(buyerPage, /buyer_rfq_negotiation_messages/);
  assert.match(buyerPage, /RfqBuyerNegotiationPanel/);
  assert.match(supplierPage, /rfqh6_supplier_thread/);
  assert.match(supplierPage, /RfqSupplierNegotiation/);
  assert.match(supplierActions, /rfqh6_supplier_post/);
  assert.match(buyerActions, /rfqh6_buyer_post/);
});

test("RFQH6 buyer notifications reuse the current private RFQ token and Resend idempotency", () => {
  assert.match(buyerActions, /createRfqh3DispatchSecurity/);
  assert.match(buyerActions, /RESEND_API_KEY/);
  assert.match(buyerActions, /rfqh6-/);
  assert.match(emailLib, /Apri trattativa RFQ/);
  assert.match(emailLib, /target interno originario della RFQ resta privato/i);
});

test("RFQH6 negotiation notifications share the RFQH3 delivery and suppression ledger safely", () => {
  assert.match(deliveryLedger, /message_kind in\('invite','reminder','negotiation'\)/);
  assert.match(deliveryLedger, /rfqh6_queue_notification_ledger/);
  assert.match(deliveryLedger, /rfqh6_sync_notification_ledger/);
  assert.match(deliveryLedger, /v_is_negotiation/);
  assert.match(deliveryLedger, /if not v_is_negotiation then/);
  assert.match(deliveryLedger, /buyer_rfq_email_suppressions/);
  assert.match(deliveryLedger, /status in\('responded','declined'\)/);
});

test("RFQH6 supplier replies notify the buyer without exposing server secrets", () => {
  assert.match(supplierNotification, /rfqh6_supplier_notification_context_impl/);
  assert.match(supplierNotification, /where d\.token_hash=p_token_hash/);
  assert.match(supplierNotification, /from auth\.users/);
  assert.match(supplierActions, /rfqh6_supplier_notification_context/);
  assert.match(supplierActions, /RESEND_API_KEY/);
  assert.doesNotMatch(supplierActions, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
  assert.match(emailLib, /Nuovo messaggio dal fornitore/);
});

test("RFQH6 stays isolated while RFQH7 owns award decisions", () => {
  const surface = buyerPanel + supplierPanel + buyerActions + supplierActions;
  assert.doesNotMatch(surface, /auto.?award|awardSupplier|createAward|supplier_score/i);
  assert.match(buyerPage, /RfqAwardPanel/);
});
