import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");

const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const worklist = read("../components/commercial-unified-worklist.tsx");
const data = read("../lib/commercial-unified-data.ts");
const inbound = read("../lib/commercial-data.ts");
const builder = read("../components/buyer-distinta-builder.tsx");
const routes = read("../lib/routes.ts");

test("COMMERCIAL-UNIFY2 is one Commerciale page with filters, query and in-place detail", () => {
  assert.match(commercial, /CommercialUnifiedWorklist/);
  assert.match(commercial, /params\.view/);
  assert.match(commercial, /params\.item/);
  assert.match(commercial, /params\.q/);
  assert.match(worklist, /Tutte/);
  assert.match(worklist, /Ricevute/);
  assert.match(worklist, /Inviate/);
  assert.match(worklist, /Offerte/);
  assert.match(worklist, /Ordini/);
  assert.match(worklist, /Bozze/);
  assert.match(worklist, /commercialHref\(view, query, key\)/);
  assert.match(worklist, /Trattativa selezionata/);
  assert.match(worklist, /role="search"/);
  assert.match(worklist, /commercial-worklist-q/);
  assert.match(worklist, /getOperationalEntityData/);
  assert.match(worklist, /aria-current/);
});

test("COMMERCIAL-UNIFY2 reuses existing builder inline and returns after saving private RFQ", () => {
  assert.match(commercial, /params\.compose === "1"/);
  assert.match(commercial, /composing \? listBuyerDistintaPublicDimensions\(\)/);
  assert.match(commercial, /<BuyerDistintaBuilder/);
  assert.match(commercial, /returnToCommercial/);
  assert.match(builder, /returnToCommercial = false/);
  assert.match(builder, /existingDistintaId: savedId/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.match(builder, /if \(returnToCommercial\)/);
  assert.match(builder, /\?item=campaign:/);
  assert.match(commercial, /canWrite && params\.compose/);
  assert.match(worklist, /canWrite \? \(/);
});

test("COMMERCIAL-UNIFY2 never confuses inbound orders, outbound RFQ, quote or PO", () => {
  for (const table of ["buyer_rfq_campaigns", "buyer_rfq_quotes", "buyer_purchase_order_drafts", "buyer_distintas"]) {
    assert.ok(data.includes('from("' + table + '")'), table);
  }
  assert.match(data, /getExplorerData\(\{ role: "all", organizationId \}\)/);
  assert.match(data, /"inbound-rfq"/);
  assert.match(data, /"inbound-offer"/);
  assert.match(data, /"inbound-order"/);
  assert.match(data, /"campaign"/);
  assert.match(data, /"quote"/);
  assert.match(data, /"purchase-order"/);
  assert.match(data, /"distinta"/);
  assert.match(data, /visibleCampaigns\.get\(quote\.rfq_id\)/);
  assert.match(data, /visibleCampaigns\.get\(order\.rfq_id\)/);
  assert.match(data, /seen\.has\(item\.key\)/);
});

test("COMMERCIAL-UNIFY2 protects tenant boundary and distinguishes failed reads from genuine empty state", () => {
  assert.match(inbound, /filters\.organizationId/);
  assert.match(inbound, /memberships\?\.find\(\(row\) => row\.organization_id === filters\.organizationId\)/);
  assert.match(inbound, /if \(!membership\)/);
  assert.match(data, /\.eq\("organization_id", organizationId\)/);
  assert.match(data, /inboundUnavailable/);
  assert.match(data, /procurementUnavailable/);
  assert.match(data, /inbound\?\.mode === "demo"/);
  assert.match(worklist, /data\.partial/);
  assert.match(worklist, /nessun dato dimostrativo è presentato come reale/);
  assert.match(worklist, /non autorizzata per questo account/);
  assert.match(commercial, /canWriteWorkspace\(context\.role\)/);
  assert.doesNotMatch(data + worklist, /service_role|SUPABASE_SERVICE_ROLE_KEY|rfqh_secure/);
});

test("COMMERCIAL-UNIFY2 preserves deep links, ownership and explicit action boundaries", () => {
  assert.match(worklist, /item\.href/);
  assert.match(routes, /campaign: \(id: string\) => \`\/rfq-hub\/\$\{id\}\`/);
  assert.match(routes, /savedDistinta: \(id: string\)/);
  assert.match(worklist, /Confronto, negoziazione e ordini/);
  assert.match(commercial, /Nessun invio ai fornitori avviene automaticamente/);
  assert.match(worklist, /nessuna pubblicazione automatica/);
  assert.match(worklist, /getOperationalEntityData\(inboundKind, item\.id\)/);
  assert.match(data, /validId/);
  assert.match(worklist, /related\.slice\(0, 6\)/);
});
