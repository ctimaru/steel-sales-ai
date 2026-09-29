import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const opportunityPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/opportunities/[id]/page.tsx", import.meta.url),
  "utf8",
);
const composer = fs.readFileSync(
  new URL("../components/marketplace-response-workspace.tsx", import.meta.url),
  "utf8",
);
const buyerInbox = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/responses/page.tsx", import.meta.url),
  "utf8",
);
const buyerDetail = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/responses/[id]/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/actions.ts", import.meta.url),
  "utf8",
);
const data = fs.readFileSync(new URL("../lib/marketplace.ts", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260929153000_p5_4_governed_supplier_response.sql", import.meta.url),
  "utf8",
);

test("P5.4 adds governed response, structured lines and append-only audit entities", () => {
  assert.match(migration, /create table public\.marketplace_responses/);
  assert.match(migration, /create table public\.marketplace_response_lines/);
  assert.match(migration, /create table public\.marketplace_response_events/);
  assert.match(migration, /event_sequence bigint generated always as identity/);
  assert.match(migration, /marketplace_response_events is append-only/);
  assert.match(migration, /unique\(request_id,supplier_organization_id\)/);
});

test("P5.4 response authority requires open request, entitlement and actual P5.3 unlock", () => {
  assert.match(migration, /private\.p5_3_resolve_entitlement_impl/);
  assert.match(migration, /from public\.marketplace_unlocks u/);
  assert.match(migration, /reason','entitlement_required'/);
  assert.match(migration, /reason','unlock_required'/);
  assert.match(migration, /reason','request_not_open'/);
  assert.match(migration, /eligible_after_unlock/);
  assert.match(migration, /Active Marketplace entitlement required at submission/);
});

test("P5.4 enforces duplicate and anti-spam boundaries", () => {
  assert.match(migration, /unique\(request_id,supplier_organization_id\)/);
  assert.match(migration, /v_org_24h>=40/);
  assert.match(migration, /v_user_1h>=15/);
  assert.match(migration, /reason','rate_limited'/);
  assert.match(migration, /already has a Marketplace response/);
});

test("P5.4 supplier workspace never returns anonymous buyer organization identity", () => {
  const start = migration.indexOf("create or replace function private.p5_4_supplier_response_json");
  const end = migration.indexOf("create or replace function private.p5_4_supplier_workspace_impl");
  const supplierJson = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(supplierJson, /buyer_visibility_mode/);
  assert.doesNotMatch(supplierJson, /buyer_organization_id|organization_network_company_links|private\.p5_4_supplier_identity/);
  assert.match(opportunityPage, /l’identità del buyer resta protetta|L’identità del buyer resta protetta/);
});

test("P5.4 supplier composer is server-action based and line-bound", () => {
  assert.match(opportunityPage, /getMarketplaceSupplierWorkspace/);
  assert.match(opportunityPage, /MarketplaceResponseWorkspace/);
  assert.match(composer, /createMarketplaceResponse/);
  assert.match(composer, /upsertMarketplaceResponseLine/);
  assert.match(composer, /submitMarketplaceResponse/);
  assert.match(composer, /withdrawMarketplaceResponse/);
  assert.match(composer, /request_line_id/);
  assert.match(composer, /Per inviare una quotazione serve almeno una linea con prezzo/);
});

test("P5.4 web mutation layer uses RPCs rather than direct Marketplace tables", () => {
  for (const rpc of [
    "p5_4_create_response",
    "p5_4_update_response",
    "p5_4_upsert_response_line",
    "p5_4_remove_response_line",
    "p5_4_submit_response",
    "p5_4_withdraw_response",
    "p5_4_buyer_transition",
  ]) {
    assert.match(actions, new RegExp(rpc));
  }
  assert.doesNotMatch(actions, /\.from\("marketplace_responses"\)/);
  assert.doesNotMatch(actions, /\.from\("marketplace_response_lines"\)/);
});

test("P5.4 buyer inbox and detail only consume governed read models", () => {
  assert.match(data, /p5_4_buyer_inbox/);
  assert.match(data, /p5_4_buyer_response_detail/);
  assert.match(buyerInbox, /getMarketplaceBuyerResponses/);
  assert.match(buyerDetail, /getMarketplaceBuyerResponse/);
  assert.match(buyerDetail, /transitionMarketplaceBuyerResponse/);
  assert.match(routes, /responses: "\/marketplace\/responses"/);
  assert.match(routes, /response: \(id: string\)/);
  assert.match(migration, /and mr\.submitted_at is not null/);
});

test("P5.4 lifecycle is explicit and does not create private Commercial Memory offers/orders", () => {
  for (const status of [
    "draft",
    "submitted",
    "withdrawn",
    "declined",
    "acknowledged",
    "closed",
  ]) {
    assert.match(migration, new RegExp("'" + status + "'"));
  }
  assert.doesNotMatch(migration, /insert into public\.(offers|orders|rfqs)/i);
  assert.match(composer, /separata dalle[\s\S]*offerte private della Commercial Memory/);
  assert.match(buyerDetail, /Non viene creato[\s\S]*automaticamente alcun ordine o offerta/);
});

test("P5.4 tables are RPC-only for authenticated clients", () => {
  for (const table of [
    "marketplace_responses",
    "marketplace_response_lines",
    "marketplace_response_events",
  ]) {
    assert.match(
      migration,
      new RegExp("alter table public\\." + table + " enable row level security"),
    );
  }
  assert.match(migration, /revoke all on table public\.marketplace_responses from public,anon,authenticated/);
  assert.match(migration, /revoke all on table public\.marketplace_response_lines from public,anon,authenticated/);
  assert.match(migration, /revoke all on table public\.marketplace_response_events from public,anon,authenticated/);
});
