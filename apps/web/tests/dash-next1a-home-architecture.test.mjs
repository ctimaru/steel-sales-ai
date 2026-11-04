import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const pulse = read("../components/dashboard-steel-pulse.tsx");
const discovery = read("../components/dashboard-discovery-feed.tsx");
const chrome = read("./demotest23-chrome-auth.mjs");

test("DASH-NEXT1A Home places a truthful action-first entry above feed", () => {
  // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
  // HOME-FOCUS1 (founder decision, 4 Nov 2026): the Home RFQ box and the "Cosa richiede attenzione" strip were removed; superseded checks rewritten.
  assert.equal(home.indexOf("<HomeAiComposer"), -1, "no RFQ box on the Home");
  assert.equal(home.indexOf('aria-labelledby="daily-priorities"'), -1, "no attention strip on the Home");
  assert.ok(home.indexOf("<HomeFeed ") > home.indexOf('data-testid="home-center"'));
  assert.doesNotMatch(home, /orderedQuickActions|quick-action-shortcuts|<WorkspaceHomePanels/);
  assert.match(home, /href=\{appRoutes\.commercial\.home \+ "\?compose=1#commercial-compose"\}/);
});

test("DASH-NEXT1A keeps network discovery and primary action role-aware", () => {
  assert.match(home, /const canWrite = canWriteWorkspace\(context\.role\)/);
  assert.match(home, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(home, /buildHomeFeedViewer\(context, networkEnabled, networkEntitled\)/);
  assert.doesNotMatch(home, /<HomeAiComposer/); // HOME-FOCUS1: the Distinta starts from Commerciale
  assert.doesNotMatch(home, /getNetworkActivityFeed/);
});

test("DASH-NEXT1A compact metrics are real totals, not pseudo open pipelines", () => {
  assert.match(home, /mode === "live" && operationalKpis\.length > 0/);
  assert.match(home, /operational\.rfqs/);
  assert.match(home, /operational\.offers/);
  assert.match(home, /operational\.orders/);
  assert.match(home, /Totali registrati · non rappresentano attività aperte/);
  assert.match(home, /Nessun dato dimostrativo viene mostrato come reale/);
  // HOME-FOCUS1: RFQ status stays in the left rail as verified totals only.
  assert.match(home, /procurementSummary\.active_rfqs/);
  assert.doesNotMatch(home, /AI-powered search|Risultati generati dall.AI/);
});

test("DASH-NEXT1A hides redundant Steel Pulse controls during true empty state", () => {
  assert.match(pulse, /cards\.length > 0 \? <nav/);
  assert.match(pulse, /cards\.length > 0 \? <div className="flex justify-center"/);
  assert.match(pulse, /Nessuna notizia verificata per ora/);
  assert.match(pulse, /Steel Pulse temporaneamente non disponibile/);
  assert.match(pulse, /cards\.slice\(0, 2\)\.map/);
  assert.match(pulse, /card\.source_url/);
  assert.match(discovery, /Le RFQ private e i dettagli riservati non compaiono/);
  assert.doesNotMatch(home + pulse + discovery, /dangerouslySetInnerHTML/);
});

test("DASH-NEXT1A reconciled Chrome acceptance preserves CALC-NEXT1F and action links", () => {
  assert.match(chrome, /CALC-NEXT1F: exercise the real private route/);
  assert.match(chrome, /viewer cannot open private buyer composer by locale URL/);
  // HOME-FOCUS1 (founder decision, 4 Nov 2026): Chrome proves the RFQ box is gone on desktop and mobile.
  assert.match(chrome, /The RFQ box is gone from the Home/);
  assert.match(chrome, /HOME-FOCUS1: no RFQ box on the mobile Home/);
});
