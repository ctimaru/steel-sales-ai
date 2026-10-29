import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const standard = read("../app/(italian)/(public)/knowledge/norme/[slug]/page.tsx");
const grade = read("../app/(italian)/(public)/knowledge/gradi/[slug]/page.tsx");
const en = read("../app/(english)/en/knowledge/tubes/page.tsx");
const calculator = read("../components/public-tube-weight-calculator.tsx");

test("SEO-GROWTH2.B: EN 10219 technical page makes one safe deep link into the existing calculator", () => {
  assert.match(standard, /standard\.slug === "en-10219"/);
  assert.match(standard, /"EN 10219: profili cavi a freddo"/);
  assert.match(standard, /href="\/knowledge\/tubes\?standard=en10219&source=school"/);
  assert.match(standard, /Calcola peso EN 10219/);
  assert.match(standard, /non sostituisce i dati certificati/i);
  assert.match(standard, /canonical: absoluteUrl\(`\/knowledge\/norme\/\$\{standard\.slug\}`\)/);
  assert.match(grade, /grade\.slug === "16mo3"/);
  assert.match(grade, /"16Mo3 \(1\.5415\): tubi per pressione"/);
  assert.match(grade, /canonical: absoluteUrl\(`\/knowledge\/gradi\/\$\{grade\.slug\}`\)/);
});

test("SEO-GROWTH2.C: visible, compact CHS/SHS/RHS answers follow the real shared calculator", () => {
  const tool = en.indexOf('<CalculatorRegionSwitch locale="en"');
  const quick = en.indexOf('data-testid="seo-growth2c-quick-reference"');
  const details = en.indexOf('<details data-testid="school-growth1b-en-editorial"');
  assert.ok(tool >= 0 && quick > tool && details > quick);
  for (const value of ["CHS · Circular hollow section", "SHS · Square hollow section", "RHS · Rectangular hollow section"]) {
    assert.ok(en.includes(value));
  }
  assert.match(en, /href="\/en\/distinta"/);
  assert.match(en, /EN 10210 or EN 10219/);
  assert.match(en, /nominal EN section weights account for corner radii/i);
  assert.match(en, /robotsForParameterizedPage\(hasParameters\)/);
  assert.match(en, /canonical: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  assert.doesNotMatch(en, /free area calculator|Calculate cross-sectional area instantly/i);
});

test("SEO-GROWTH2.C: English header hierarchy fixes only a semantic heading, not calculator formulas", () => {
  assert.match(calculator, /inEmbeddedBuilder \|\| locale === "de" \|\| locale === "fr" \|\| locale === "es" \|\| locale === "en" \? <h2/);
  assert.match(calculator, /: <h1 className="text-sm font-bold/);
});
