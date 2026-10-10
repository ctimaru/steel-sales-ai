import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(relative) {
  return fs.readFileSync(new URL(relative, import.meta.url), "utf8");
}

const routes = source("../lib/routes.ts");
const canonicalCampaign = source("../app/(workspace)/rfq-hub/[rfqId]/page.tsx");
const buyer = source("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
const supplierRfq = source("../app/(public)/rfq/respond/[token]/page.tsx");
const supplierPo = source("../app/(public)/po/respond/[token]/page.tsx");
const governance = source("../components/rfqh13-governance-panel.tsx");
const sql = source("../../../supabase/tests/rfqh14_pilot_readiness.sql");
const runbook = source("../../../docs/rfqh14-real-procurement-pilot-runbook.md");

test("RFQH14 preserves canonical buyer navigation and existing private workflow", () => {
  assert.match(routes, /campaign: \(id: string\) => `\/rfq-hub\/\$\{id\}`/);
  assert.match(routes, /supplier: \(id: string\) => `\/rfq-hub\/suppliers\/\$\{id\}`/);
  assert.match(routes, /intelligence: "\/rfq-hub\/intelligence"/);
  assert.match(canonicalCampaign, /marketplace\/rfq-hub\/\[rfqId\]\/page/);
  assert.match(buyer, /rfqh5_quote_comparison/);
  assert.match(buyer, /Rfqh13GovernancePanel/);
  assert.match(buyer, /Rfqh9PurchaseOrderPanel/);
});

test("RFQH14 keeps both supplier portals token-scoped and out of search indexing", () => {
  for (const portal of [supplierRfq, supplierPo]) {
    assert.match(portal, /robots: \{ index: false, follow: false \}/);
    assert.match(portal, /createHash\("sha256"\)/);
    assert.match(portal, /p_token_hash/);
  }
  assert.match(supplierPo, /Rfqh9SupplierPoPortal/);
  assert.match(supplierRfq, /RfqSupplierResponseForm/);
});

test("RFQH14 retains second-person approvals and dedicated audit export", () => {
  assert.match(governance, /require_award_approval/);
  assert.match(governance, /require_po_approval/);
  assert.match(governance, /Scarica audit JSON/);
});

test("RFQH14 production baseline and real pilot acceptance cannot be conflated", () => {
  assert.match(sql, /begin transaction read only;/);
  assert.match(sql, /rollback;/);
  assert.match(sql, /has_schema_privilege\('anon','private','USAGE'\)/);
  assert.match(sql, /buyer_purchase_order_supplier_responses/);
  assert.match(runbook, /real external pilot NOT STARTED/);
  assert.match(runbook, /NO-GO/);
  assert.match(runbook, /Real end-to-end procurement case/);
  assert.match(runbook, /Storage backup\/recovery/);
  assert.doesNotMatch(sql, /\b(insert into|update public\.|delete from|truncate|create table)\b/i);
});
