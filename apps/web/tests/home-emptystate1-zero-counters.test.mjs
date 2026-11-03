import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../app/(italian)/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");

test("HOME-EMPTYSTATE1 three verified zeros become an empty state, partial data does not", () => {
  assert.match(home, /procurementKpis && procurementKpis\.length === 3 && procurementKpis\.every\(\(kpi\) => kpi\.value === 0\)/);
});

test("HOME-EMPTYSTATE1 both counter surfaces use the empty state and keep their structure", () => {
  assert.equal(home.match(/<RfqEmptyState canWrite=\{canWrite\} firstRun=\{firstRun\.active\} \/>/g).length, 2);
  // Workspace card: empty state comes before the zero rows branch.
  const empty = home.indexOf(") : procurementAllZero ? (");
  const rows = home.indexOf(") : procurementKpis && procurementKpis.length > 0 ? (");
  assert.ok(empty !== -1 && rows > empty);
  // Tasks tab keeps the RFQ lifecycle section (DASH-FEED2 contract).
  assert.match(home, /aria-label="RFQ lifecycle"[\s\S]*procurementAllZero \?/);
  // The verified-state footnote is shown only with real, non-zero rows.
  assert.ok(home.indexOf("Stato acquisti verificato") > rows);
});

test("HOME-EMPTYSTATE1 creation links are existing routes and only for roles that can write", () => {
  assert.match(home, /data-testid="home-rfq-empty-state"/);
  assert.match(home, /appRoutes\.commercial\.home \+ "\?compose=1#commercial-compose"/);
  assert.match(home, /href="\/distinta"/);
  assert.match(home, /firstRun \? "Crea la tua prima RFQ" : "Crea una RFQ"/);
  assert.match(home, /\{canWrite \? \(\s*<div className="flex flex-wrap items-center gap-x-4 gap-y-1">/);
  assert.match(home, /Quando il tuo team invierà richieste di offerta/);
});
