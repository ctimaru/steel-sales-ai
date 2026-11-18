import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const overview = read("../app/(workspace)/marketplace/rfq-hub/page.tsx");
const alias = read("../app/(workspace)/rfq-hub/page.tsx");
const savedPage = read("../app/(workspace)/rfq-hub/distinte/[distintaId]/page.tsx");
const archive = read("../app/(workspace)/rfq-hub/distinte/page.tsx");
const shell = read("../components/app-shell.tsx");
const ia = read("../lib/workspace-information-architecture.ts");
const button = read("../components/rfq-hub-create-from-snapshot.tsx");
const helperSource = read("../lib/rfq-hub-overview.ts");
const routes = read("../lib/routes.ts");

const code = ts.transpileModule(helperSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const helper = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

test("RFQ-IA3 summarizes actual saved snapshots, campaigns, submitted quotes and PO drafts", () => {
  // RFQHUB1: one row per Distinta, built from the same real tables.
  for(const name of ["buyer_distintas","buyer_rfq_campaigns","buyer_rfq_suppliers","buyer_rfq_quotes","buyer_purchase_order_drafts"]) {
    assert.ok(overview.includes('.from("' + name + '")'), name);
  }
  assert.match(overview, /\.eq\("status", "submitted"\)/);
  assert.match(overview, /\{ count: "exact" \}/);
  assert.match(overview, /const state = rfqHubRowState\(facts\)/);
  assert.match(alias, /marketplace\/rfq-hub\/page/);
});

test("RFQ-IA3 scopes every data source to active org and preserves Supabase RLS", () => {
  assert.match(overview, /const context = await getWorkspaceContext\(\)/);
  assert.match(overview, /const organizationId = context\.organizationId/);
  assert.equal((overview.match(/\.eq\("organization_id", organizationId\)/g) || []).length, 5);
  assert.doesNotMatch(overview + savedPage, /serviceRole|service_role|createAdminClient/);
  assert.match(savedPage, /\.eq\("id", distintaId\)\.eq\("organization_id", context\.organizationId\)/);
  assert.match(savedPage, /if \(error \|\| !snapshot\) notFound\(\)/);
  assert.match(savedPage, /requireWorkspaceWriteRole|canWriteWorkspace\(context\.role\)/);
  assert.match(savedPage, /snapshot\.owner_user_id === context\.userId/);
  assert.match(savedPage, /privateNoIndexRobots/);
  assert.match(overview, /privateNoIndexRobots/);
});

test("RFQ-IA3 uses a scoped existing inbox engine, not an invented activity score", () => {
  // RFQHUB1: «Da gestire» reuses rfqh10, restricted to this organization's campaigns.
  assert.match(overview, /supabase\.rpc\("rfqh10_procurement_inbox", \{ p_limit: 200 \}\)/);
  assert.match(overview, /rfqHubAttentionByRfq\(queue\.data\)/);
  const ids = new Set(["own1"]);
  const data = { items: [
    {item_id:"1",rfq_id:"own1",requires_action:true,priority:"urgent",headline:"Rispondi",detail:"Preventivo"},
    {item_id:"2",rfq_id:"foreign",requires_action:true,priority:"urgent",headline:"Riservato",detail:"Non visibile"},
    {item_id:"3",rfq_id:"own1",requires_action:false,priority:"waiting",headline:"Attesa",detail:""},
  ]};
  const items=helper.parseHubInboxItems(data,ids);
  assert.deepEqual(items.map(x=>x.item_id),["1"]);
  assert.equal(helper.parseHubInboxItems(null,ids),null);
  assert.equal(helper.parseHubInboxItems({},ids),null);
});

test("RFQ-IA3 maps statuses from real DB contracts and shows unknown status as verify", () => {
  assert.equal(helper.rfqCampaignStatusLabel("collecting"),"Raccolta offerte");
  assert.equal(helper.rfqCampaignStatusLabel("ready"),"Pronta");
  assert.equal(helper.rfqCampaignStatusLabel("unknown"),"Stato da verificare");
  assert.equal(helper.rfqOrderStatusLabel("supplier_confirmed"),"Confermato");
  assert.equal(helper.rfqOrderStatusLabel("change_requested"),"Modifica richiesta");
  assert.equal(helper.rfqOrderStatusLabel("unknown"),"Stato da verificare");
  assert.equal(helper.formatHubDate(null),"—");
});

test("RFQ-IA3 archived snapshot has RLS-gated details and owner-only campaign conversion", () => {
  assert.match(routes, /savedDistinta: \(id: string\) => `\/rfq-hub\/distinte\/\$\{id\}`/);
  assert.match(savedPage, /buyer_distinta_lines/);
  assert.match(savedPage, /snapshot\.document_requirements/);
  assert.match(savedPage, /RfqHubCreateFromSnapshot/);
  assert.match(savedPage, /!campaignError && \(relatedCampaigns\?\.length \?\? 0\) === 0/);
  assert.match(button, /createBuyerRfqCampaign\(distintaId\)/);
  assert.match(button, /router\.push\(appRoutes\.rfqHub\.campaign\(result\.rfqId\)/);
  assert.match(savedPage, /Lo snapshot è immutabile/);
  assert.match(overview, /appRoutes\.rfqHub\.savedDistinta\(distinta\.id\)/);
});

test("RFQ-IA3 saved archive is paginated, noindex, organization-scoped and accessible in contextual menu", () => {
  // RFQHUB1: the archive is the «Archiviate» view of Centro RFQ; the old URL redirects.
  assert.match(routes, /savedDistinte: "\/rfq-hub\/distinte"/);
  assert.match(archive, /redirect\(rfqHubHref\(view === "archived" \? "archiviate" : "attive"/);
  assert.match(overview, /\.range\(\(page - 1\) \* PAGE_SIZE, page \* PAGE_SIZE - 1\)/);
  assert.match(overview, /request\.not\("archived_at", "is", null\)/);
  assert.match(ia, /return "rfq:archive"/);
  assert.match(shell, /label: "Attività", contextKey: "commercial:home"/);
});
