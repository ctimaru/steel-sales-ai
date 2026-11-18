import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const rowsSource = read("../lib/rfq-hub-rows.ts");
const hub = read("../app/(italian)/(workspace)/marketplace/rfq-hub/page.tsx");
const nav = read("../lib/commercial-director-navigation.ts");
const shell = read("../components/workspace-commercial-director-shell.tsx");
const badge = read("../components/purchasing-attention-count.tsx");
const attention = read("../app/(italian)/(workspace)/rfq-hub/attention-actions.ts");
const start = read("../components/rfq-hub-start-button.tsx");
const rfqInbox = read("../app/(italian)/(workspace)/rfq-hub/inbox/page.tsx");
const marketInbox = read("../app/(italian)/(workspace)/marketplace/inbox/page.tsx");
const archive = read("../app/(italian)/(workspace)/rfq-hub/distinte/page.tsx");

const code = ts.transpileModule(rowsSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const rows = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const campaign = (status) => ({ id: "r1", status, due_at: null, created_at: "2026-11-18T09:00:00Z" });
const facts = (over) => ({ campaign: null, previousCount: 0, supplierCount: 0, respondedCount: 0,
  orderStatus: null, attention: null, ...over });

test("RFQHUB1 row state tells where each Distinta stands and where it opens", () => {
  assert.deepEqual(rows.rfqHubRowState(facts({})),
    { label: "Bozza · fornitori da scegliere", tone: "draft", target: "distinta" });
  assert.deepEqual(rows.rfqHubRowState(facts({ campaign: campaign("draft") })),
    { label: "Fornitori da scegliere", tone: "todo", target: "step2" });
  assert.equal(rows.rfqHubRowState(facts({ campaign: campaign("ready"), supplierCount: 1 })).label,
    "Da inviare · 1 destinatario");
  assert.equal(rows.rfqHubRowState(facts({ campaign: campaign("draft"), supplierCount: 3 })).target, "step3");
  assert.equal(rows.rfqHubRowState(facts({ campaign: campaign("collecting"), supplierCount: 4 })).label,
    "In attesa · 0 risposte su 4");
  assert.equal(rows.rfqHubRowState(facts({ campaign: campaign("launched"), supplierCount: 4, respondedCount: 2 })).label,
    "Offerte da confrontare · 2 su 4");
  assert.equal(rows.rfqHubRowState(facts({ campaign: campaign("awarded") })).label, "Aggiudicata · ordine da preparare");
  assert.equal(rows.rfqHubRowState(facts({ campaign: campaign("awarded"), orderStatus: "supplier_confirmed" })).tone, "done");
  assert.equal(rows.rfqHubRowState(facts({ campaign: campaign("closed") })).label, "Chiusa");
  assert.equal(rows.rfqHubRowState(facts({ campaign: campaign("weird") })).label, "Stato da verificare");
});

test("RFQHUB1 views and old addresses map to one canonical Centro RFQ URL", () => {
  assert.equal(rows.rfqHubView("da-gestire"), "da-gestire");
  assert.equal(rows.rfqHubView("archiviate"), "archiviate");
  assert.equal(rows.rfqHubView("<script>"), "attive");
  assert.equal(rows.rfqHubHref("attive"), "/rfq-hub");
  assert.equal(rows.rfqHubHref("da-gestire"), "/rfq-hub?vista=da-gestire");
  assert.equal(rows.rfqHubHref("archiviate", "tubi 6\"", 2), "/rfq-hub?vista=archiviate&q=tubi+6%22&page=2");
  assert.match(rfqInbox, /redirect\(rfqHubHref\("da-gestire"\)\)/);
  assert.match(marketInbox, /redirect\(rfqHubHref\("da-gestire"\)\)/);
  assert.match(archive, /redirect\(rfqHubHref\(/);
});

test("RFQHUB1 attention keeps one open action per RFQ and ignores waiting items", () => {
  const map = rows.rfqHubAttentionByRfq({ items: [
    { rfq_id: "a", requires_action: true, priority: "urgent", action_label: "Confronta offerte", headline: "x" },
    { rfq_id: "a", requires_action: true, priority: "normal", action_label: "Secondo" },
    { rfq_id: "b", requires_action: false, priority: "waiting", headline: "Attesa" },
    { rfq_id: "c", requires_action: true, priority: "normal", headline: "Sollecita fornitore" },
    "junk", null,
  ]});
  assert.deepEqual([...map.keys()], ["a", "c"]);
  assert.deepEqual(map.get("a"), { label: "Confronta offerte", urgent: true });
  assert.deepEqual(map.get("c"), { label: "Sollecita fornitore", urgent: false });
  assert.equal(rows.rfqHubAttentionByRfq(null), null);
  assert.equal(rows.rfqHubAttentionByRfq([]), null);
  assert.equal(rows.rfqHubAttentionCount({ items: [] }), 0);
  assert.equal(rows.rfqHubAttentionCount(undefined), 0);
});

test("RFQHUB1 menu: Centro RFQ with counter and Fornitori RFQ, no Inbox or Distinte", () => {
  assert.match(nav, /\{ label: "Centro RFQ", href: appRoutes\.rfqHub\.home, counter: "purchasing_attention" \}/);
  assert.match(nav, /\{ label: "Fornitori RFQ", href: appRoutes\.rfqHub\.suppliers \}/);
  assert.doesNotMatch(nav, /label: "Inbox e risposte"|label: "Distinte"/);
  assert.match(shell, /item\.counter === "purchasing_attention" \? <PurchasingAttentionCount \/> : null/);
  assert.match(badge, /data-testid="purchasing-attention-count"/);
  assert.match(attention, /"use server"/);
  assert.match(attention, /rfqHubAttentionCount/);
});

test("RFQHUB1 list is read-only, tenant scoped and creates RFQs only through the owner action", () => {
  assert.match(hub, /data-testid="rfq-hub-list"/);
  assert.match(hub, /data-testid="rfq-hub-row"/);
  assert.match(hub, /request\.is\("archived_at", null\)/);
  assert.match(hub, /request\.not\("archived_at", "is", null\)/);
  assert.match(start, /createBuyerRfqCampaign\(distintaId\)/);
  assert.doesNotMatch(hub + start + attention, /service_role|createAdminClient|autoDispatch|issuePurchaseOrder|launchCampaign/);
});
