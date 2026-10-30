import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const pulse = read("../components/dashboard-steel-pulse.tsx");
const discovery = read("../components/dashboard-discovery-feed.tsx");
const chrome = read("./demotest23-chrome-auth.mjs");

test("DASH-NEXT1A Home places a truthful action-first entry above feed", () => {
  const hero = home.indexOf('<section aria-labelledby="quick-actions"');
  const attention = home.indexOf('<section aria-labelledby="daily-priorities"');
  const feed = home.indexOf("<DashboardSteelPulse state={pulse} />");
  const pulsePreview = home.indexOf("<DashboardPulsePreview state={pulse} />");
  assert.ok(hero >= 0 && pulsePreview > hero && attention > pulsePreview && feed > attention);
  assert.match(home, /Come posso aiutarti oggi\?/);
  assert.match(home, /aria-label="Cerca RFQ, offerte, ordini, aziende e documenti nello storico commerciale"/);
  assert.match(home, /href=\{appRoutes\.commercial\.search\}/);
  assert.match(home, /href=\{appRoutes\.commercial\.home\}/);
  assert.match(home, /aria-label="Aree di lavoro"/);
  assert.match(home, /orderedQuickActions\.map/);
  assert.match(home, /\.filter\(\(action\) => action\.href !== appRoutes\.commercial\.search\)/);
});

test("DASH-NEXT1A keeps network discovery and primary action role-aware", () => {
  assert.match(home, /const presentation = dashboardPresentation/);
  assert.match(home, /presentation\.primaryIntent/);
  assert.match(home, /networkEnabled \? appRoutes\.network\.directory : appRoutes\.knowledge\.workspace/);
  assert.match(home, /const canWrite = canWriteWorkspace\(context\.role\)/);
  assert.match(home, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(home, /networkEntitled\s*\?\s*getNetworkActivityFeed/);
  assert.match(home, /activity=\{activity\.items\}/);
});

test("DASH-NEXT1A compact metrics are real totals, not pseudo open pipelines", () => {
  assert.match(home, /mode === "live" && operationalKpis\.length > 0/);
  assert.match(home, /operational\.rfqs/);
  assert.match(home, /operational\.offers/);
  assert.match(home, /operational\.orders/);
  assert.match(home, /Totali registrati · non rappresentano attività aperte/);
  assert.match(home, /Nessun dato dimostrativo viene mostrato come reale/);
  assert.match(home, /procurementActions\.map/);
  assert.match(home, /requires_action === true/);
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
  assert.match(chrome, /Dedicated search must open the existing private commercial history/);
  assert.match(chrome, /Mobile actions must retain touch targets/);
});
