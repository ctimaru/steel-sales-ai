import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../app/(italian)/(public)/knowledge/tubes/", import.meta.url);
const landing = readFileSync(new URL("page.tsx", root), "utf8");
const dimension = readFileSync(new URL("[slug]/page.tsx", root), "utf8");
test("ITA1A maintains clean canonical, hreflang and parameter noindex", () => {
  assert.match(landing, /canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(landing, /robotsForParameterizedPage\(hasParameters\)/);
  assert.match(landing, /en: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  assert.match(landing, /Calcolo peso tubi acciaio/);
  // HOME-CALC1: the calculator header is the single visible H1 of the landing page.
  const calculator = readFileSync(new URL("../components/public-tube-weight-calculator.tsx", import.meta.url), "utf8");
  assert.match(calculator, /<h1[^>]*>Calcolo peso tubi in acciaio al metro<\/h1>/);
  assert.doesNotMatch(landing, /<h1/);
});
test("ITA1B size pages have a visible prefilled calculator CTA", () => {
  const link = dimension.indexOf('Calcola peso e quantità →');
  const crumb = dimension.indexOf('<nav aria-label="Breadcrumb"');
  assert.ok(link > -1 && link < crumb);
  for (const param of ['family:', 'thickness:', 'query.set("od"', 'query.set("width"', 'query.set("height"']) {
    assert.ok(dimension.includes(param), `Missing ${param}`);
  }
  assert.match(dimension, /href=\{calculatorHref\(dimension\)\}/);
});
