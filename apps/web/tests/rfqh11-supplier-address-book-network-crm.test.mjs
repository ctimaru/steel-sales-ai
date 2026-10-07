import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const foundation = fs.readFileSync(
  new URL("../../../supabase/migrations/20261007082452_rfqh11_supplier_address_book.sql", import.meta.url),
  "utf8",
);
const readModels = fs.readFileSync(
  new URL("../../../supabase/migrations/20261007082729_rfqh11_supplier_crm_read_models.sql", import.meta.url),
  "utf8",
);
const directoryPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/suppliers/page.tsx", import.meta.url),
  "utf8",
);
const detailPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/suppliers/[profileId]/page.tsx", import.meta.url),
  "utf8",
);
const editor = fs.readFileSync(
  new URL("../components/rfqh11-supplier-profile-editor.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/suppliers/actions.ts", import.meta.url),
  "utf8",
);
const rfqActions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/actions.ts", import.meta.url),
  "utf8",
);
const picker = fs.readFileSync(
  new URL("../components/rfq-supplier-add-form.tsx", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(
  new URL("../lib/routes.ts", import.meta.url),
  "utf8",
);
const ia = fs.readFileSync(
  new URL("../lib/workspace-information-architecture.ts", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);

test("RFQH11 creates one buyer/org supplier profile per canonical identity", () => {
  assert.match(foundation, /create table if not exists public\.buyer_supplier_profiles/);
  assert.match(foundation, /unique\(owner_user_id,organization_id,identity_key\)/);
  assert.match(foundation, /supplier_organization_id uuid references public\.organizations/);
  assert.match(foundation, /supplier_network_company_id uuid references public\.network_companies/);
  assert.match(foundation, /supplier_company_id uuid references public\.companies/);
  assert.match(foundation, /supplier_contact_id uuid references public\.contacts/);
  assert.match(foundation, /supplier_network_contact_id uuid references public\.network_contacts/);
});

test("RFQH11 automatically harvests RFQ suppliers without creating a parallel company database", () => {
  assert.match(foundation, /buyer_rfq_suppliers_rfqh11_profile_sync/);
  assert.match(foundation, /on conflict\(owner_user_id,organization_id,identity_key\)/);
  assert.match(foundation, /last_rfq_id=excluded\.last_rfq_id/);
  assert.match(foundation, /with ranked as/);
  assert.match(foundation, /from public\.buyer_rfq_suppliers s/);
  assert.doesNotMatch(foundation, /create table if not exists public\.buyer_supplier_companies/);
});

test("RFQH11 profile curation is owner scoped with explicit Data API grants and RLS", () => {
  assert.match(foundation, /enable row level security/);
  assert.match(foundation, /revoke all on public\.buyer_supplier_profiles from anon,authenticated/);
  assert.match(foundation, /grant select,update on public\.buyer_supplier_profiles to authenticated/);
  assert.match(foundation, /owner_user_id=\(select auth\.uid\(\)\)/);
  assert.match(foundation, /is_organization_member\(organization_id,true\)/);
  assert.match(foundation, /rfqh11_update_supplier_profile/);
  assert.match(foundation, /cardinality\(tags\)<=10/);
});

test("RFQH11 CRM metrics are calculated from RFQ quote award and PO history", () => {
  assert.match(readModels, /rfqh11_supplier_directory/);
  assert.match(readModels, /buyer_rfq_quotes/);
  assert.match(readModels, /buyer_rfq_quote_lines/);
  assert.match(readModels, /buyer_rfq_award_allocations/);
  assert.match(readModels, /buyer_purchase_order_drafts/);
  assert.match(readModels, /response_rate_pct/);
  assert.match(readModels, /avg_response_hours/);
  assert.match(readModels, /awarded_total_eur/);
  assert.match(readModels, /confirmed_po_count/);
});

test("RFQH11 exposes transparent last-price and detailed price history", () => {
  assert.match(readModels, /latest_price/);
  assert.match(readModels, /normalized_eur_t/);
  assert.match(readModels, /normalized_eur_m/);
  assert.match(readModels, /RFQH11-supplier-detail-v1/);
  assert.match(readModels, /'price_history'/);
  assert.match(detailPage, /Storico prezzi ricevuti/);
  assert.match(detailPage, /€ \{formatNumber\(row\.eur_t, 2\)\}/);
});

test("RFQH11 supports preferred suppliers tags groups and private notes", () => {
  assert.match(foundation, /preferred boolean not null default false/);
  assert.match(foundation, /tags text\[\] not null/);
  assert.match(foundation, /notes text/);
  assert.match(editor, /Supplier preferito/);
  assert.match(editor, /Tag \/ gruppi/);
  assert.match(editor, /Note private/);
  assert.match(actions, /rfqh11_update_supplier_profile/);
});

test("RFQH11 preferences flow back into RFQH2 supplier selection", () => {
  assert.match(rfqActions, /from\("buyer_supplier_profiles"\)/);
  assert.match(rfqActions, /preferredIdentityKeys/);
  assert.match(rfqActions, /candidate\.identity_key/);
  assert.match(picker, /Apri rubrica supplier/);
  assert.match(picker, /Supplier preferiti nella rubrica acquisti/);
});

test("RFQH11 keeps Network as linked identity instead of duplicating its profile", () => {
  assert.match(readModels, /saved_in_network/);
  assert.match(directoryPage, /Salvato nel Network/);
  assert.match(detailPage, /La rubrica conserva il link, non duplica il profilo Network/);
  assert.match(detailPage, /appRoutes\.network\.company/);
});

test("RFQH11 is integrated into Marketplace navigation", () => {
  assert.match(routes, /suppliers: "\/marketplace\/suppliers"/);
  assert.match(routes, /supplier: \(id: string\)/);
  assert.match(ia, /"marketplace:suppliers"/);
  assert.doesNotMatch(shell, /label: "Supplier"/);
  assert.match(directoryPage, /La tua rubrica fornitori/);
});
