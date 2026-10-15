import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const load=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const it=load("../app/(public)/knowledge/tubes/page.tsx");
const en=load("../app/en/knowledge/tubes/page.tsx");
const calculator=load("../components/public-tube-weight-calculator.tsx");
const words=load("../lib/tube-calculator-locale.ts");
const engine=load("../lib/international-tube-mass.ts");
const css=load("../app/globals.css");
const switcher=load("../components/calculator-region-switch.tsx");

test("I18N7 IT/EN share the same canonical standard-based estimator and catalogue",()=>{
  assert.match(it,/CalculatorRegionSwitch locale="it" initialRegion="eu"/);
  assert.match(en,/CalculatorRegionSwitch locale="en" initialRegion="eu"/);
  assert.match(switcher,/PublicTubeWeightCalculator references=\{references\?\?\[\]\}/);
  assert.match(switcher,/initialValues=\{initialValues\} locale=\{locale\}/);
  assert.doesNotMatch(en,/EnglishTubeWeightCalculator/);
  assert.match(en,/cachedPublicTubeReferences\(\)/);
  assert.match(en,/revalidate: 86400/);
  assert.match(en,/supportedStandards/);
  for(const item of ["round_tube","square_tube","rectangular_tube","en10219","en10210","geometric"]) assert.ok(calculator.includes(item));
  assert.match(calculator,/calculateTubeSection/);
  assert.match(engine,/standardRectangularAreaMm2/);
  assert.match(calculator,/targetBarsExact/);
  assert.match(calculator,/exactReference/);
});

test("I18N7 localized public controls provide copy and an RFQ bill destination",()=>{
  assert.match(calculator,/tubeCalculatorText\(text, locale\)/);
  assert.match(calculator,/formatNumber\(value, digits, locale\)/);
  assert.match(calculator,/copyTextToClipboard\(resultText\(currentSnapshot\)\)/);
  assert.match(calculator,/setActionFeedback\("Risultato copiato\."\)/);
  assert.match(words,/"Risultato copiato\.": "Result copied\. Paste it into your RFQ bill or an email\."/);
  assert.match(calculator,/window\.location\.assign\(locale === "en" \? "\/en\/distinta" : "\/distinta"\)/);
  assert.match(calculator,/Add this calculation to an RFQ bill/);
  assert.match(calculator,/Aggiungi questa misura alla distinta/);
  assert.match(calculator,/Copy failed\. Please check clipboard permissions\./);
  assert.match(calculator,/shareUrl\(currentSnapshot\)/);
  assert.match(words,/"Lunghezza barra": "Bar length"/);
  assert.match(words,/"Numero barre": "Number of bars"/);
});

test("I18N7 copy, favourite and RFQ CTAs enforce visible foreground under global CSS",()=>{
  for(const cls of ["tube-calculator-copy-action","tube-calculator-favourite-selected","tube-calculator-rfq-link"]){
    assert.match(calculator,new RegExp(cls));
    assert.match(css,new RegExp("#calcolatore-pesi \\."+cls));
  }
  assert.match(css,/#calcolatore-pesi \.tube-calculator-copy-action \{[^}]*-webkit-text-fill-color: #ffffff !important/s);
  assert.match(css,/#calcolatore-pesi \.tube-calculator-rfq-link \{[^}]*-webkit-text-fill-color: #123b34 !important/s);
  assert.match(calculator,/locale=\{locale\}/);
});
