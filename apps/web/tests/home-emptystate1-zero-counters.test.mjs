import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../app/(italian)/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");

test("HOME-EMPTYSTATE1 three verified zeros become an empty state, partial data does not", () => {
  assert.match(home, /procurementKpis && procurementKpis\.length === 3 && procurementKpis\.every\(\(kpi\) => kpi\.value === 0\)/);
});

test("HOME-EMPTYSTATE1 both counter surfaces use the empty state and keep their structure", () => {
  // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
  assert.equal(home.match(/<RfqEmptyState canWrite=\{canWrite\} firstRun=\{firstRun\.active\} \/>/g).length, 1);
  const empty = home.indexOf("{procurementAllZero ? (");
  const rows = home.indexOf(") : procurementKpis && procurementKpis.length > 0 ? (");
  assert.ok(empty !== -1 && rows > empty);
  assert.match(home, /aria-label="RFQ lifecycle"[\s\S]*procurementAllZero \?/);
  assert.doesNotMatch(home, /Stato acquisti verificato/);
});

test("HOME-EMPTYSTATE1 creation links are existing routes and only for roles that can write", () => {
  assert.match(home, /data-testid="home-rfq-empty-state"/);
  assert.match(home, /appRoutes\.commercial\.home \+ "\?compose=1#commercial-compose"/);
  assert.match(home, /href="\/distinta"/);
  assert.match(home, /firstRun \? "Crea la tua prima RFQ" : "Crea una RFQ"/);
  assert.match(home, /\{canWrite \? \(\s*<div className="flex flex-wrap items-center gap-x-4 gap-y-1">/);
  assert.match(home, /Quando il tuo team invierà richieste di offerta/);
});
