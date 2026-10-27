import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const page=readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx",import.meta.url),"utf8");
test("Commerciale exposes compact operational views before unified worklist",()=>{
  assert.match(page,/data-testid="commercial-cockpit-tabs"/);
  assert.ok(page.indexOf('data-testid="commercial-cockpit-tabs"') < page.indexOf("<CommercialUnifiedWorklist"));
  for (const view of ["all","received","sent","offers","orders","drafts"]) assert.ok(page.includes('["'+view+'",'));
  assert.match(page,/aria-current=\{view === quickView \? "page" : undefined\}/);
  assert.match(page,/commercial-worklist/);
  assert.match(page,/data-testid="commercial-ai-first"/);
  assert.match(page,/<CommercialCalculatorQuickAccess references=\{calculatorReferences\}/);
});
