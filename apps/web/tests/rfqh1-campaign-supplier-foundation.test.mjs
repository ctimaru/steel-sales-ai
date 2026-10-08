import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006101500_rfqh1_campaign_supplier_foundation.sql", import.meta.url),
  "utf8",
);
const distintaActions = fs.readFileSync(
  new URL("../app/(public)/distinta/actions.ts", import.meta.url),
  "utf8",
);
const distintaBuilder = fs.readFileSync(
  new URL("../components/buyer-distinta-builder.tsx", import.meta.url),
  "utf8",
);
const hub = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/page.tsx", import.meta.url),
  "utf8",
);
const detail = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);
const supplierForm = fs.readFileSync(
  new URL("../components/rfq-supplier-add-form.tsx", import.meta.url),
  "utf8",
);
const appShell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);

test("RFQH1 keeps outbound procurement RFQs separate from inbound commercial rfqs", () => {
  assert.match(migration, /create table if not exists public\.buyer_rfq_campaigns/);
  assert.match(migration, /source_distinta_id uuid not null references public\.buyer_distintas/);
  assert.match(migration, /marketplace_request_id uuid null references public\.marketplace_requests/);
  assert.doesNotMatch(migration, /alter table public\.rfqs/);
});

test("RFQH1 targets many private suppliers without exposing recipient lists", () => {
  assert.match(migration, /create table if not exists public\.buyer_rfq_suppliers/);
  assert.match(migration, /supplier_email_normalized/);
  assert.match(migration, /Maximum 100 suppliers per RFQ/);
  assert.match(migration, /buyer_rfq_suppliers_rfq_email_uidx/);
  assert.match(migration, /owner_user_id=\(select auth\.uid\(\)\)/);
});

test("RFQH1 creates an append-only audit surface for campaign and supplier creation", () => {
  assert.match(migration, /create table if not exists public\.buyer_rfq_events/);
  assert.match(migration, /'campaign_created'/);
  assert.match(migration, /'supplier_added'/);
  assert.match(migration, /revoke all on public\.buyer_rfq_events from anon, authenticated/);
  assert.match(migration, /grant select on public\.buyer_rfq_events to authenticated/);
});

test("RFQH1 bridges a saved public Buyer Distinta into the private hub", () => {
  assert.match(distintaActions, /rfqh1_create_campaign_from_distinta/);
  assert.match(distintaBuilder, /Avvia RFQ multi-fornitore/);
  assert.match(distintaBuilder, /router\.push\(appRoutes\.rfqHub\.campaign\(result\.rfqId\)\)/);
});

test("RFQH1 exposes a first-class private RFQ Hub and supports supplier targeting", () => {
  assert.match(appShell, /label: "Le mie RFQ"/);
  assert.match(hub, /Le tue richieste ai fornitori/);
  assert.match(detail, /Fornitori target/);
  assert.match(supplierForm, /addSupplierToBuyerRfq/);
  assert.match(supplierForm, /Email \*/);
});
