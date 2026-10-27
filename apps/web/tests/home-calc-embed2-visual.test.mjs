import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = p => fs.readFileSync(new URL(p, import.meta.url), "utf8");
test("HOME-CALC-EMBED2 styles only modal route, not the shared calculator", () => {
 const layout = read("../components/home-calculator-embed-style.tsx");
 const it = read("../app/(italian)/(public)/calculator-embed/page.tsx");
 const en = read("../app/(english)/en/calculator-embed/page.tsx");
 assert.match(layout, /\[data-calculator-embed\]/);
 for (const key of ["data-cockpit-workspace","data-cockpit-fields","data-cockpit-results","data-cockpit-toolbar","data-cockpit-kpis"]) assert.ok(layout.includes(key));
 assert.match(layout, /minmax\(235px,1fr\)/);
 assert.match(layout, /@media\(max-width:699px\)/);
 for (const page of [it,en]) {
   assert.match(page, /HomeCalculatorEmbedStyle/);
   assert.match(page, /CalculatorRegionSwitch/);
   assert.match(page, /index: false/);
 }
 assert.doesNotMatch(layout, /fetch\(|useState\(|calculateTubeSection|localStorage|display:none.*data-cockpit/);
});
