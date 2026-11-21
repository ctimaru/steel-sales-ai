import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const page = readFileSync(new URL("../app/(english)/en/knowledge/tubes/page.tsx", import.meta.url), "utf8");
test("SEO-GROWTH2 puts query-relevant geometry guidance visibly above the calculator",()=>{
  const heading=page.indexOf('id="hollow-section-search-guide"');
  const calc=page.indexOf('<CalculatorRegionSwitch locale="en"');
  assert.ok(heading >= 0 && heading < calc);
  assert.match(page, /rectangular hollow section \(RHS\)/);
  assert.match(page, /circular hollow section \(CHS\)/);
  assert.match(page, /A = B × H − \(B − 2t\) × \(H − 2t\)/);
  assert.match(page, /not certified product weights/);
  assert.match(page, /canonical: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
});
