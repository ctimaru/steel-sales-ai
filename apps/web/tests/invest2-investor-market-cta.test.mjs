import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/investor-opportunity-page.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const english = readFileSync(new URL("../app/en/investors/page.tsx", import.meta.url), "utf8");
const italian = readFileSync(new URL("../app/investitori/page.tsx", import.meta.url), "utf8");

test("INVEST2 includes sourced 2025 industry data with no implied software TAM", () => {
  for (const key of ["1.85bn t", "125.8m t", "20.7m t", "€152bn", "1,85 mld t", "€152 mld"]) {
    assert.ok(source.includes(key), "Missing sourced industry figure: " + key);
  }
  assert.match(source, /worldsteel\.org\/data\/annual-production-steel-data/);
  assert.match(source, /eurofer\.eu\/assets\/european-steel-in-figures-2026/);
  assert.match(source, /not Smart Steel Sales' software addressable market/);
  assert.match(source, /non rappresentano il mercato indirizzabile del software/);
  assert.match(source, /TAM\/SAM\/SOM/);
});

test("INVEST2 presents plausible investor thesis, preserves human-reviewed plan", () => {
  assert.match(source, /vertical SaaS/i);
  assert.match(source, /subject to pilot validation/);
  assert.match(source, /Business Plan/);
  assert.match(source, /mailto:hello@smartsteelsales\.com/);
  for (const page of [english, italian]) {
    assert.match(page, /<InvestorOpportunityPage/);
    assert.match(page, /mailto:hello@smartsteelsales\.com/);
    assert.doesNotMatch(page, /<form/);
    assert.doesNotMatch(page, /\.pdf/);
  }
});

test("INVEST2 fixes invisible white-on-white CTA via scoped contrast override", () => {
  assert.match(source, /className="investor-plan-cta/);
  assert.match(source, /investor-plan-cta-label/);
  assert.match(stylesheet, /\.investor-plan-cta\s*\{[^}]*color:\s*#123b34\s*!important/s);
  assert.match(stylesheet, /\.investor-plan-cta\s*>\s*span\s*\{[^}]*-webkit-text-fill-color:\s*#123b34\s*!important/s);
  assert.match(source, /sm:w-auto/);
});
