import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const summary = read("../components/commercial-deal-intelligence.tsx");
const guidance = read("../lib/commercial-deal-next-step.ts");
const worklist = read("../components/commercial-unified-worklist.tsx");

test("COMM-UX6.C presents a single verified deal summary before the governed next step", () => {
  assert.match(worklist, /const facts = await loadCommercialDealFacts\(item, detail\)/);
  const contextAt = worklist.indexOf("<CommercialDealIntelligence facts={facts} />");
  const actionAt = worklist.indexOf('data-testid="commercial-deal-next-step"');
  assert.ok(contextAt > 0 && actionAt > contextAt);
  assert.equal(worklist.split("<CommercialDealIntelligence facts={facts} />").length - 1, 1);
  for (const id of ["commercial-deal-intelligence", "commercial-deal-materials", "commercial-deal-sources"]) {
    assert.match(summary, new RegExp('data-testid="' + id + '"'));
  }
  assert.match(worklist, /<CommercialCampaignOperations/);
  assert.match(worklist, /<CommercialDealQuickActions/);
});

test("COMM-UX6.C never loads a quote or PO without both matching tenant and campaign", () => {
  assert.match(summary, /getWorkspaceContext\(\)/);
  assert.match(summary, /\.eq\("organization_id", context\.organizationId\)/);
  assert.match(summary, /quote\.rfq_id !== campaignId/);
  assert.match(summary, /po\.rfq_id !== campaignId/);
  assert.match(summary, /\.eq\("rfq_id", quote\.rfq_id\)/);
  assert.match(summary, /if \(error \|\| !campaign\) return null/);
  assert.match(summary, /if \(distintaError \|\| !distinta\) return null/);
  assert.match(summary, /if \(lineError\) return null/);
  assert.doesNotMatch(summary, /service_role|SUPABASE_SERVICE_ROLE_KEY|\.rpc\(".*issue/);
});

test("COMM-UX6.C does not fabricate money, documents, suppliers or automatic next steps", () => {
  assert.match(summary, /price: null, \/\/ Prices are per line/);
  assert.match(summary, /Target /);
  assert.match(summary, /item\.kind === "purchase-order" \? money\(totalOrderEur\) : null/);
  assert.match(summary, /questa scheda non presume che esistano/);
  assert.match(summary, /"Da verificare nella RFQ"/);
  assert.match(summary, /"Da selezionare"/);
  assert.match(guidance, /if \(!canWrite\)/);
  assert.match(guidance, /Nessun invio|nessun invio|Non viene inviato/);
  assert.match(guidance, /status === "draft"/);
  assert.match(guidance, /status === "launched" \|\| status === "collecting"/);
  assert.doesNotMatch(summary, /sendEmail|dispatchRFQ|issuePurchaseOrder/);
});
