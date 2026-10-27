import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = p => fs.readFileSync(new URL(p, import.meta.url), "utf8");
test("HOME-CALC-EMBED1 modal loads only reusable calculator surface", () => {
 const dock=read("../components/home-floating-tools.tsx");
 const it=read("../app/(italian)/(public)/calculator-embed/page.tsx");
 const en=read("../app/(english)/en/calculator-embed/page.tsx");
 for(const [source,locale] of [[it,"it"],[en,"en"]]) {
  assert.match(source,new RegExp('locale="'+locale+'"'));
  assert.match(source,/CalculatorRegionSwitch/);
  assert.match(source,/listPublicTubeDimensionPages/);
  assert.match(source,/index: false/);
  assert.doesNotMatch(source,/PublicHomeHeader|EnglishPublicSubpage|CalculatorPageLanguageSelector|EnStructuralMethodEvidence|FAQPage/);
  assert.doesNotMatch(source,/mobile-cookie-consent|privacy-reopen-button/);
 }
 assert.match(dock,/weights: "\/calculator-embed"/);
 assert.match(dock,/weights: "\/en\/calculator-embed"/);
 assert.match(dock,/src=\{embeddedHrefs\[tool\]\}/);
 assert.match(dock,/href=\{hrefs\[tool\]\}/);
 assert.match(dock,/visited\.map/);
});
