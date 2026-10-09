import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261009104500_rfq_ia4_bridge_privacy_gate.sql");
const bridgePanel = read("../components/rfq-marketplace-bridge-panel.tsx");
const bridgeActions = read("../app/(workspace)/marketplace/rfq-hub/[rfqId]/marketplace-actions.ts");
const rfqDetail = read("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
const marketplaceNew = read("../app/(workspace)/marketplace/new/page.tsx");
const marketplaceActions = read("../app/(workspace)/marketplace/actions.ts");
const marketplaceDetail = read("../app/(workspace)/marketplace/[id]/page.tsx");
const marketplaceHome = read("../app/(workspace)/marketplace/page.tsx");
const marketplaceList = read("../app/(workspace)/marketplace/requests/page.tsx");
const routes = read("../lib/routes.ts");
const rfqHome = read("../app/(workspace)/marketplace/rfq-hub/page.tsx");
const rfqSource = read("../../../supabase/migrations/20261006142403_rfqh8_network_marketplace_bridge.sql");

test("RFQ-IA4 retains one buyer process: private distinta -> RFQ -> optional Marketplace bridge", () => {
  assert.match(routes, /createDistinta: "\/rfq-hub\/distinta"/);
  assert.match(rfqHome, /appRoutes\.rfqHub\.createDistinta/);
  assert.match(rfqDetail, /RfqMarketplaceBridgePanel/);
  assert.match(bridgePanel, /prepareRfqh8MarketplaceBridge/);
  assert.match(bridgePanel, /publishRfqh8MarketplaceBridge/);
  assert.match(bridgePanel, /importRfqh8MarketplaceResponse/);
  assert.match(bridgePanel, /Importa nel confronto RFQ/);
  assert.match(marketplaceHome, /Apri RFQ Hub/);
  assert.match(marketplaceList, /Pubblicazioni Marketplace/);
  assert.match(marketplaceNew, /Percorso consigliato/);
  assert.match(marketplaceNew, /href=\{appRoutes\.rfqHub\.createDistinta\}/);
  assert.match(marketplaceNew, /mode !== "standalone"/);
  assert.match(marketplaceNew, /mode=standalone/);
  assert.match(marketplaceNew, /name="creation_mode" value="standalone_marketplace"/);
  assert.match(marketplaceActions, /textValue\(formData, "creation_mode"\) !== "standalone_marketplace"/);
  assert.match(marketplaceActions, /requireWorkspaceWriteRole\(appRoutes\.marketplace\.home\)/);
});

test("RFQ-IA4 requires explicit consent in UI AND on server before any publication", () => {
  assert.match(bridgePanel, /setPublishConsent/);
  assert.match(bridgePanel, /publishConsent/);
  assert.match(bridgePanel, /Controlla prima di pubblicare/);
  assert.match(bridgePanel, /Ho verificato descrizioni, quantità, identità/);
  assert.match(bridgePanel, /window\.confirm/);
  assert.match(bridgePanel, /disabled=\{pending \|\| !publishConsent \|\| !canExecute\}/);
  assert.match(bridgePanel, /acknowledged: publishConsent/);
  assert.match(bridgeActions, /acknowledged: boolean/);
  assert.match(bridgeActions, /input\.acknowledged !== true/);
  assert.match(bridgeActions, /rfqh8_publish_marketplace_bridge/);
  assert.match(bridgeActions, /revalidatePath\("\/rfq-hub\/" \+ input\.rfqId\.trim\(\)\)/);
  assert.match(bridgePanel, /canExecute = false/);
  assert.match(rfqDetail, /canExecute=\{canExecuteCritical\}/);
});

test("RFQ-IA4 privacy hardens DB: no buyer target, private note, emails or offers in Marketplace mirror", () => {
  const start=migration.indexOf("create or replace function private.rfqh8_prepare_marketplace_bridge_impl");
  const end=migration.indexOf("create or replace function private.rfqh8_publish_marketplace_bridge_impl");
  const prepare=migration.slice(start,end);
  assert.ok(start>=0 && end>start);
  assert.match(prepare, /insert into public\.marketplace_request_lines/);
  assert.match(prepare, /nullif\(v_line\.description,''\)/);
  assert.doesNotMatch(prepare, /nullif\(v_line\.note/);
  assert.doesNotMatch(prepare, /target_eur_t|target_eur_m|target_total_eur|supplier_email|buyer_message|payment_terms|quote_total/);
  const publishing=migration.slice(end,migration.indexOf("-- Block manual Marketplace RPC mutations"));
  assert.match(publishing, /update public\.marketplace_request_lines ml/);
  assert.match(publishing, /where link\.bridge_id=v_bridge\.id/);
  assert.match(publishing, /ml\.request_id=v_bridge\.marketplace_request_id/);
  assert.match(publishing, /private\.p5_1_publish_request_impl/);
  assert.doesNotMatch(publishing, /nullif\(l\.note/);
  assert.match(bridgePanel, /Nessun prezzo target, offerta ricevuta, email dei fornitori o nota privata/);
  assert.match(bridgePanel, /Verifica che anche le descrizioni non contengano dettagli riservati/);
  assert.match(rfqDetail, /sourceLines=\{lineRows\.map/);
  assert.doesNotMatch(bridgePanel, /targetEurT|targetEurM|targetTotalEur/);
});

test("RFQ-IA4 prevents the legacy editor and direct Marketplace public RPCs from changing managed RFQs", () => {
  assert.match(migration, /v_request\.source_kind<>'manual'/);
  assert.match(migration, /private\.p5_1_require_request\(p_request_id,true\)/);
  for(const rpc of ["p5_1_update_request","p5_1_add_request_line","p5_1_remove_request_line","p5_1_publish_request","p5_1_withdraw_request"]) {
    const start = migration.indexOf("create or replace function public."+rpc+"(");
    assert.ok(start>0,rpc+" wrapper");
    const body=migration.slice(start,migration.indexOf("$$;",start)+3);
    assert.match(body, /perform private\.rfq_ia4_require_standalone_request\(p_request_id\)/,rpc);
  }
  assert.match(migration, /private\.p5_1_publish_request_impl/); // bridge retains governed privileged path
  assert.match(migration, /rfq_ia4_request_origin_impl/);
  assert.match(migration, /private\.p5_1_require_request\(p_request_id,false\)/);
  assert.match(migration, /private\.rfqh13_can_view_rfq/);
  assert.match(marketplaceDetail, /supabase\.rpc\("rfq_ia4_request_origin"/);
  assert.match(marketplaceDetail, /const editable = canWrite && standalone && request\.status === "draft"/);
  assert.match(marketplaceDetail, /const rfqManaged = origin\?\.source_kind === "rfq_hub"/);
  assert.match(marketplaceDetail, /Richiesta gestita nel RFQ Hub/);
  assert.match(marketplaceDetail, /href=\{appRoutes\.rfqHub\.campaign\(origin\.rfq_id\)\}/);
  assert.match(marketplaceDetail, /Provenienza della ricerca non disponibile/);
});

test("RFQ-IA4 retains legally distinct published, prepared, imported and owner-scoped stages", () => {
  assert.match(rfqSource, /rfqh8_prepare_marketplace_bridge_impl/);
  assert.match(rfqSource, /rfqh8_publish_marketplace_bridge_impl/);
  assert.match(rfqSource, /rfqh8_import_marketplace_response_impl/);
  assert.match(rfqSource, /'draft','rfq_hub'/);
  assert.match(rfqSource, /Marketplace quote contains non-EUR or non-normalizable priced lines/);
  assert.match(rfqSource, /owner_user_id=v_user_id/);
  assert.match(migration, /private\.p5_1_require_actor\(v_campaign\.organization_id,true\)/);
  assert.match(bridgePanel, /Target RFQ non viene mai pubblicato/);
  assert.match(bridgePanel, /response\.imported/);
});
