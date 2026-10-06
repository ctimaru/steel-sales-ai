import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bridge = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006142403_rfqh8_network_marketplace_bridge.sql", import.meta.url),
  "utf8",
);
const stateModel = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006142814_rfqh8_bridge_state_read_model.sql", import.meta.url),
  "utf8",
);
const stateHardening = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006143144_rfqh8_bridge_state_hardening.sql", import.meta.url),
  "utf8",
);
const panel = fs.readFileSync(
  new URL("../components/rfq-marketplace-bridge-panel.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/marketplace-actions.ts", import.meta.url),
  "utf8",
);
const buyerPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);
const supplierPage = fs.readFileSync(
  new URL("../app/(public)/rfq/respond/[token]/page.tsx", import.meta.url),
  "utf8",
);

test("RFQH8 reuses the existing Marketplace instead of creating a parallel demand board", () => {
  assert.match(bridge, /source_kind in\('manual','rfq_hub'\)/);
  assert.match(bridge, /insert into public\.marketplace_requests/);
  assert.match(bridge, /insert into public\.marketplace_request_lines/);
  assert.match(bridge, /private\.p5_1_publish_request_impl/);
  assert.match(bridge, /private\.p5_5_refresh_request_matches_impl/);
});

test("RFQH8 mirrors RFQ lines without exposing internal buyer target prices", () => {
  const prepareStart = bridge.indexOf("rfqh8_prepare_marketplace_bridge_impl");
  const prepareEnd = bridge.indexOf("rfqh8_supplier_suggestions_impl");
  const prepareBody = bridge.slice(prepareStart, prepareEnd);
  assert.match(prepareBody, /v_line\.line_tonnes,'t'/);
  assert.match(prepareBody, /v_line\.description/);
  assert.match(prepareBody, /v_line\.standard_code/);
  assert.doesNotMatch(prepareBody, /target_eur_t|target_eur_m|target_total_eur/);
  assert.match(panel, /Target RFQ non viene mai pubblicato/);
});

test("RFQH8 keeps Marketplace publication explicit and separate from bridge preparation", () => {
  assert.match(bridge, /'draft',\s*'rfq_hub'/);
  assert.match(bridge, /rfqh8_publish_marketplace_bridge_impl/);
  assert.match(actions, /prepareRfqh8MarketplaceBridge/);
  assert.match(actions, /publishRfqh8MarketplaceBridge/);
  assert.match(panel, /Bridge preparato\. Nulla è stato pubblicato/);
  assert.match(panel, /Pubblica nel Marketplace/);
  assert.match(panel, /window\.confirm/);
});

test("RFQH8 supplier suggestions reuse P5.5 matching and RFQH2 identity resolution", () => {
  assert.match(bridge, /private\.p5_5_compute_request_matches/);
  assert.match(bridge, /public\.marketplace_matches/);
  assert.match(bridge, /private\.rfqh2_best_network_contact/);
  assert.match(bridge, /private\.rfqh2_linked_supplier_organization/);
  assert.match(panel, /addSupplierToBuyerRfq/);
  assert.match(panel, /Aggiungi alla RFQ privata/);
  assert.match(panel, /match_score/);
});

test("RFQH8 imports Marketplace quotes as versioned RFQ quotes for RFQH5", () => {
  assert.match(bridge, /rfqh8_import_marketplace_response_impl/);
  assert.match(bridge, /response_kind<>'quote'/);
  assert.match(bridge, /status='superseded'/);
  assert.match(bridge, /insert into public\.buyer_rfq_quotes/);
  assert.match(bridge, /insert into public\.buyer_rfq_quote_lines/);
  assert.match(actions, /rfqh8_import_marketplace_response/);
  assert.match(panel, /Importa nel confronto RFQ/);
});

test("RFQH8 normalizes Marketplace t kg m and pcs price units", () => {
  assert.match(bridge, /quantity_unit='t'/);
  assert.match(bridge, /quantity_unit='kg'/);
  assert.match(bridge, /quantity_unit='m'/);
  assert.match(bridge, /quantity_unit='pcs'/);
  assert.match(bridge, /v_market_line\.unit_price\*1000\/v_line\.weight_kg_m/);
  assert.match(bridge, /v_market_line\.unit_price\/v_line\.bar_length_m/);
  assert.match(bridge, /Marketplace quote contains non-EUR or non-normalizable priced lines/);
});

test("RFQH8 keeps imported response provenance and acknowledges the Marketplace response", () => {
  assert.match(bridge, /buyer_rfq_marketplace_response_imports/);
  assert.match(bridge, /marketplace_response_imported/);
  assert.match(bridge, /status='acknowledged'/);
  assert.match(bridge, /source','rfq_hub_import'/);
});

test("RFQH8 bridge data is owner-scoped and read-only through direct table access", () => {
  assert.match(bridge, /enable row level security/);
  assert.match(bridge, /revoke all on public\.buyer_rfq_marketplace_bridges from anon,authenticated/);
  assert.match(bridge, /grant select on public\.buyer_rfq_marketplace_bridges to authenticated/);
  assert.match(bridge, /owner_user_id=\(select auth\.uid\(\)\)/);
  assert.match(bridge, /security invoker/);
});

test("RFQH8 read model exposes bridge suggestions responses and fixed numeric summaries", () => {
  assert.match(stateModel, /rfqh8_bridge_state_impl/);
  assert.match(stateModel, /'responses'/);
  assert.match(stateHardening, /jsonb_array_length/);
  assert.match(stateHardening, /'contactable_matches'/);
  assert.match(buyerPage, /rfqh8_bridge_state/);
  assert.match(buyerPage, /RfqMarketplaceBridgePanel/);
});

test("RFQH8 guest claim funnel is optional and capability-scoped", () => {
  assert.match(bridge, /rfqh_secure\.rfqh8_guest_claim_context_impl/);
  assert.match(bridge, /where d\.token_hash=p_token_hash/);
  assert.match(bridge, /claim_recommended/);
  assert.match(supplierPage, /rfqh8_guest_claim_context/);
  assert.match(supplierPage, /Puoi rispondere a questa RFQ senza creare un account/);
  assert.match(supplierPage, /Facoltativo · non influisce sulla risposta RFQ/);
  assert.match(supplierPage, /RfqSupplierResponseForm/);
});

test("RFQH8 leaves award responsibility in RFQH7", () => {
  assert.doesNotMatch(panel, /confirmRfqAward|auto.?award|supplier_score/i);
  assert.match(buyerPage, /RfqAwardPanel/);
  assert.match(panel, /Non è un award automatico/);
});
