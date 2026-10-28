import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const worklist = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");

test("Commerciale uses one navigation rail and one canonical worklist filter", () => {
  assert.match(page, /data-testid="commercial-cockpit-tabs"/);
  assert.ok(page.indexOf('data-testid="commercial-cockpit-tabs"') < page.indexOf("<CommercialUnifiedWorklist"));
  for (const view of ["all", "received", "sent", "offers", "orders", "drafts"]) {
    assert.match(worklist, new RegExp('key: "' + view + '"'));
  }
  assert.match(worklist, /aria-current=\{key === view \? "page" : undefined\}/);
  assert.match(worklist, /aria-label="Filtra attività commerciali"/);
  assert.match(page, /commercial-worklist/);
  assert.match(page, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.match(page, /<CommercialCalculatorQuickAccess references=\{calculatorReferences\}/);
});
