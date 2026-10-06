import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const foundation = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006102000_rfqh2_supplier_selection_identity_resolution.sql", import.meta.url),
  "utf8",
);
const dedupe = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006102100_rfqh2_candidate_canonical_dedupe.sql", import.meta.url),
  "utf8",
);
const vatFix = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006102200_rfqh2_verified_vat_match_fix.sql", import.meta.url),
  "utf8",
);
const entitlementFix = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006102400_rfqh2_entitlement_safe_private_resolution.sql", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/actions.ts", import.meta.url),
  "utf8",
);
const selector = fs.readFileSync(
  new URL("../components/rfq-supplier-add-form.tsx", import.meta.url),
  "utf8",
);
const detail = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);

test("RFQH2 persists one canonical supplier identity per RFQ", () => {
  assert.match(foundation, /supplier_company_id uuid/);
  assert.match(foundation, /supplier_contact_id uuid/);
  assert.match(foundation, /supplier_network_contact_id uuid/);
  assert.match(foundation, /identity_key text/);
  assert.match(foundation, /buyer_rfq_suppliers_rfq_identity_uidx/);
  assert.match(foundation, /Supplier already added to this RFQ/);
});

test("RFQH2 resolves suppliers from private, Network and registered identities", () => {
  assert.match(foundation, /rfqh2_add_supplier_impl/);
  assert.match(foundation, /email_matched_private_contact/);
  assert.match(foundation, /verified_vat_network_match/);
  assert.match(foundation, /network_identity/);
  assert.match(foundation, /registered_organization/);
  assert.match(foundation, /delivery_channel/);
});

test("RFQH2 candidate search deduplicates exact private-to-Network identity matches", () => {
  assert.match(dedupe, /rfqh2_verified_network_match_for_private_company/);
  assert.match(dedupe, /partition by a\.identity_key/);
  assert.match(dedupe, /current\.identity_key=a\.identity_key/);
  assert.match(dedupe, /current\.supplier_email_normalized=a\.email/);
});

test("RFQH2 keeps private-to-Network reconciliation behind Network entitlement", () => {
  assert.match(entitlementFix, /pa1_3_network_access_allowed_for\(p_organization_id\)/);
  assert.match(entitlementFix, /return null/);
  assert.match(vatFix, /array_agg\(nc\.id order by nc\.id\)/);
});

test("RFQH2 application surface searches and adds resolved suppliers", () => {
  assert.match(actions, /rfqh2_supplier_candidates/);
  assert.match(actions, /rfqh2_add_supplier/);
  assert.match(actions, /network_saved_companies/);
  assert.match(actions, /preferred/);
  assert.match(selector, /Preferiti/);
  assert.match(selector, /Già usati/);
  assert.match(selector, /Contatti privati/);
  assert.match(selector, /Network/);
  assert.match(selector, /Aggiungi manualmente un nuovo fornitore/);
  assert.match(selector, /identity_key/);
});

test("RFQH2 identity resolution remains visible after RFQH4 response upgrade", () => {
  assert.match(detail, /identity_source/);
  assert.match(detail, /resolution_status/);
  assert.match(detail, /Email \+ piattaforma/);
  assert.match(detail, />RFQH4</);
});
