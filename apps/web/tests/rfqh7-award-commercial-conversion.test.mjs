import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006134458_rfqh7_award_commercial_conversion.sql", import.meta.url),
  "utf8",
);
const panel = fs.readFileSync(
  new URL("../components/rfq-award-panel.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/award-actions.ts", import.meta.url),
  "utf8",
);
const buyerPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);

test("RFQH7 stores a single confirmed award with line allocations", () => {
  assert.match(migration, /create table if not exists public\.buyer_rfq_awards/);
  assert.match(migration, /rfq_id uuid not null unique/);
  assert.match(migration, /award_mode in\('full','split'\)/);
  assert.match(migration, /create table if not exists public\.buyer_rfq_award_allocations/);
  assert.match(migration, /unique\(award_id,rfq_line_id,supplier_id\)/);
});

test("RFQH7 validates latest quote and offered quantity", () => {
  assert.match(migration, /order by q\.revision_no desc/);
  assert.match(migration, /v_quote\.status<>'submitted'/);
  assert.match(migration, /Supplier latest quote must be submitted before award/);
  assert.match(migration, /Award exceeds supplier offered quantity/);
});

test("RFQH7 supports split allocations but requires full RFQ coverage", () => {
  assert.match(migration, /sum\(a\.awarded_tonnes\)/);
  assert.match(migration, /Award must cover 100%% of every RFQ line/);
  assert.match(migration, /count\(distinct a\.supplier_id\)/);
  assert.match(panel, /Aggiungi allocazione \/ split/);
});

test("RFQH7 freezes economics and buyer decision reason", () => {
  assert.match(migration, /reason text not null/);
  assert.match(migration, /savings_eur/);
  assert.match(migration, /savings_pct/);
  assert.match(migration, /rfq_award_confirmed/);
  assert.match(panel, /Motivazione decisione/);
  assert.match(actions, /p_reason/);
});

test("RFQH7 creates procurement-native PO drafts", () => {
  assert.match(migration, /create table if not exists public\.buyer_purchase_order_drafts/);
  assert.match(migration, /create table if not exists public\.buyer_purchase_order_lines/);
  assert.match(migration, /status text not null default 'draft'/);
  assert.match(migration, /commercial_order_id uuid references public\.orders/);
  assert.match(panel, /nessun ordine è stato inviato automaticamente/i);
});

test("RFQH7 keeps legacy order linkage explicit", () => {
  assert.match(migration, /rfqh7_link_commercial_order_impl/);
  assert.match(migration, /o\.organization_id=v_po\.organization_id/);
  assert.match(migration, /is_organization_member\(v_po\.organization_id,false\)/);
  assert.match(migration, /purchase_order_commercial_order_linked/);
});

test("RFQH7 closes the RFQ lifecycle on confirmation", () => {
  assert.match(migration, /set status='awarded',awarded_at=now\(\)/);
  assert.match(migration, /status='not_awarded'/);
  assert.match(migration, /buyer_rfq_negotiation_threads/);
  assert.match(migration, /set status='closed'/);
  assert.match(migration, /purchase_order_draft_created/);
});

test("RFQH7 award data is read-only through RLS", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.buyer_rfq_awards from anon,authenticated/);
  assert.match(migration, /grant select on public\.buyer_rfq_awards to authenticated/);
  assert.match(migration, /owner_user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /security invoker/);
});

test("RFQH7 prefills are suggestions and confirmation remains explicit", () => {
  assert.match(panel, /Precompila best single/);
  assert.match(panel, /Precompila best price\/riga/);
  assert.match(panel, /window\.confirm/);
  assert.match(panel, /Conferma award e crea PO draft/);
});

test("RFQH7 remains integrated before the RFQH8 bridge", () => {
  assert.match(buyerPage, /RfqQuoteComparison/);
  assert.match(buyerPage, /RfqBuyerNegotiationPanel/);
  assert.match(buyerPage, /RfqAwardPanel/);
  assert.match(buyerPage, /buyer_rfq_awards/);
  assert.match(buyerPage, /buyer_purchase_order_drafts/);
  assert.match(buyerPage, /RfqMarketplaceBridgePanel/);
});
