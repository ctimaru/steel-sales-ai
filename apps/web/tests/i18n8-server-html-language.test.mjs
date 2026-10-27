import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("I18N8: independent server-rendered root HTML languages without dynamic request headers", () => {
  assert.equal(existsSync(new URL("app/layout.tsx", root)), false);
  assert.equal(existsSync(new URL("app/(italian)/page.tsx", root)), true);
  assert.equal(existsSync(new URL("app/(english)/en/page.tsx", root)), true);
  assert.match(read("app/(italian)/layout.tsx"), /<SiteDocument lang="it">/);
  assert.match(read("app/(english)/layout.tsx"), /<SiteDocument lang="en">/);
  assert.match(read("app/site-document.tsx"), /<html lang=\{lang\}>/);
  assert.doesNotMatch(read("app/site-document.tsx"), /\b(headers|cookies|connection)\(\)/);
});

test("I18N8: target tonnage assist instructions are localized including screen readers", () => {
  const component = read("components/public-tube-weight-calculator.tsx");
  const strings = read("lib/tube-calculator-locale.ts");
  assert.match(component, /commercialShownTonnes/);
  assert.match(strings, /"Per lavorare con barre intere arrotondiamo sempre per eccesso\.": "Required full bars are always rounded up\."/);
});
