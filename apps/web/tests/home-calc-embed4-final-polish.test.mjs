import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../components/home-calculator-embed-style.tsx",import.meta.url),"utf8");
const it = readFileSync(new URL("../app/(italian)/(public)/calculator-embed/page.tsx",import.meta.url),"utf8");
const en = readFileSync(new URL("../app/(english)/en/calculator-embed/page.tsx",import.meta.url),"utf8");
test("EMBED4 visual refinements are isolated to the modal routes", () => {
 assert.match(it,/HomeCalculatorEmbedStyle/);
 assert.match(en,/HomeCalculatorEmbedStyle/);
 for (const element of ["data-calculator-embed", "data-cockpit-workspace","data-cockpit-preview","data-cockpit-kpis","data-cockpit-add"]) assert.ok(css.includes(element));
 assert.match(css, /@media\(min-width:1000px\)/);
 assert.match(css, /@media\(min-width:700px\) and \(max-width:999px\)/);
 assert.match(css, /font-variant-numeric:tabular-nums/);
 assert.doesNotMatch(css,/fetch\(|useEffect\(|useState\(|localStorage|sessionStorage/);
});
