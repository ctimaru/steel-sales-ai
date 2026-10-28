import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const operations = source("../components/commercial-campaign-operations.tsx");
const worklist = source("../components/commercial-unified-worklist.tsx");
const page = source("../app/(italian)/(workspace)/commercial/page.tsx");
const legacy = source("../app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");

test("COMMERCIAL-UNIFY2B keeps all four governed RFQ activities in the same Commerciale detail", () => {
  assert.match(page, /allowedTabs: CommercialOperationsTab\[\] = \["compare", "negotiate", "award", "po"\]/);
  assert.match(page, /tab=\{tab\}/);
  assert.match(worklist, /<CommercialCampaignOperations/);
  assert.match(worklist, /rfqId=\{item\.campaignId\}/);
  assert.match(worklist, /data-testid="comm-cine2-split-view"/);
  assert.match(operations, /Confronta offerte/);
  assert.match(operations, /Negozia/);
  assert.match(operations, /Aggiudica/);
  assert.match(operations, /Ordini PO/);
  assert.match(operations, /#commercial-operations/);
  assert.match(operations, /aria-current=\{tab === option\.id \? "page" : undefined\}/);
  assert.match(operations, /selected: string/);
});

test("COMMERCIAL-UNIFY2B shares exact existing RFQ actions instead of creating second mutation system", () => {
  for (const component of [
    "RfqQuoteComparison", "RfqBuyerNegotiationPanel", "RfqAwardPanel", "Rfqh9PurchaseOrderPanel",
  ]) {
    assert.match(operations, new RegExp("<" + component));
    assert.match(legacy, new RegExp("<" + component));
  }
  assert.match(operations, /rfqh5_quote_comparison/);
  assert.match(operations, /rfqh9_po_state/);
  assert.doesNotMatch(operations, /"use server"|fetch\(|sendBuyerDistinta|sendBuyerRfq/);
  assert.match(operations, /canExecute=\{canExecuteCritical\}/);
  assert.match(operations, /readOnly=\{campaign\.status === "awarded" \|\| !canExecuteCritical\}/);
  assert.match(operations, /azioni.*conferme esplicite/);
});

test("COMMERCIAL-UNIFY2B fails closed on role, membership and tenant mismatch", () => {
  assert.match(operations, /getWorkspaceContext\(\)/);
  assert.match(operations, /\.eq\("organization_id", context\.organizationId\)/);
  assert.match(operations, /if \(campaignError \|\| !campaign\)/);
  assert.match(operations, /canWriteWorkspace\(context\.role\)/);
  assert.match(operations, /governanceError/);
  assert.match(operations, /governed\?\.current_user\?\.role === "owner"/);
  assert.match(operations, /campaign\.owner_user_id === context\.userId/);
  assert.match(operations, /rfqh13_governance_state/);
  assert.match(operations, /Le informazioni operative non sono disponibili/);
  assert.doesNotMatch(operations, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("COMMERCIAL-UNIFY2B creates no supplier confirmation URL for viewer or non-owner", () => {
  assert.match(operations, /if \(state\.purchase_orders\?\.length\)/);
  assert.match(operations, /if \(canExecuteCritical\)/);
  assert.match(operations, /createRfqh9PoSecurity/);
  assert.match(operations, /buildRfqh9SupplierUrl/);
  assert.match(operations, /supplier_url: supplierUrl/);
});

test("COMMERCIAL-UNIFY2B preserves original RFQ route and treats unavailable data as unavailable", () => {
  assert.match(operations, /appRoutes\.rfqHub\.campaign\(campaign\.id\)/);
  assert.match(operations, /comparisonError \|\| !comparisonData/);
  assert.match(operations, /allocs\.error \|\| pos\.error/);
  assert.match(operations, /messages\?\.error \|\| targets\?\.error/);
  assert.match(operations, /no link/);
  assert.match(worklist, /non autorizzata per questo account/);
});
