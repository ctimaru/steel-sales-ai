import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const overview = read("../app/(workspace)/marketplace/rfq-hub/page.tsx");
const alias = read("../app/(workspace)/rfq-hub/page.tsx");
const savedPage = read("../app/(workspace)/rfq-hub/distinte/[distintaId]/page.tsx");
const button = read("../components/rfq-hub-create-from-snapshot.tsx");
const helperSource = read("../lib/rfq-hub-overview.ts");
const routes = read("../lib/routes.ts");

const code = ts.transpileModule(helperSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const helper = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

test("RFQ-IA3 summarizes actual saved snapshots, campaigns, submitted quotes and PO drafts", () => {
  for(const name of ["buyer_distintas","buyer_rfq_campaigns","buyer_rfq_quotes","buyer_purchase_order_drafts"]) {
    assert.ok(overview.includes('.from("' + name + '")'), name);
  }
  assert.match(overview, /<Tile label="Distinte salvate"/);
  assert.match(overview, /<Tile label="Campagne RFQ"/);
  assert.match(overview, /<Tile label="Offerte ricevute"/);
  assert.match(overview, /<Tile label="Purchase Order"/);
  assert.match(overview, /\.eq\("status", "submitted"\)/);
  assert.match(overview, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(overview, /function countText\(count: number \| null, error: unknown\)/);
  assert.match(overview, /return error \|\| count === null \? "—"/);
  assert.match(alias, /marketplace\/rfq-hub\/page/);
});

test("RFQ-IA3 scopes every data source to active org and preserves Supabase RLS", () => {
  assert.match(overview, /const context = await getWorkspaceContext\(\)/);
  assert.match(overview, /const organizationId = context\.organizationId/);
  assert.equal((overview.match(/\.eq\("organization_id", organizationId\)/g) || []).length, 8);
  assert.doesNotMatch(overview + savedPage, /serviceRole|service_role|createAdminClient/);
  assert.match(savedPage, /\.eq\("id", distintaId\)\.eq\("organization_id", context\.organizationId\)/);
  assert.match(savedPage, /if \(error \|\| !snapshot\) notFound\(\)/);
  assert.match(savedPage, /requireWorkspaceWriteRole|canWriteWorkspace\(context\.role\)/);
  assert.match(savedPage, /snapshot\.owner_user_id === context\.userId/);
  assert.match(savedPage, /privateNoIndexRobots/);
});

test("RFQ-IA3 uses a scoped existing inbox engine, not an invented activity score", () => {
  assert.match(overview, /supabase\.rpc\("rfqh10_procurement_inbox", \{ p_limit: 100 \}\)/);
  assert.match(overview, /parseHubInboxItems\(inboxResult\.data, visibleRfqIds\)/);
  assert.match(overview, /const visibleRfqIds = new Set\(campaignsList\.map/);
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
  assert.match(overview, /Le attività operative sono disponibili ai ruoli autorizzati/);
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
  assert.match(button, /router\.push\(appRoutes\.rfqHub\.campaign\(result\.rfqId\)\)/);
  assert.match(savedPage, /Lo snapshot è immutabile/);
  assert.match(overview, /appRoutes\.rfqHub\.savedDistinta\(draft\.id\)/);
});
