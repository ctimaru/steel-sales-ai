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
const cinematic=load("../components/calculator-cinematic.module.css");
const dense=load("../components/calculator-dense-cockpit.module.css");
const switcher=load("../components/calculator-region-switch.tsx");

test("I18N7 IT/EN share the same canonical standard-based estimator and catalogue",()=>{
  assert.match(it,/CalculatorRegionSwitch locale="it" initialRegion="eu"/);
  assert.match(en,/CalculatorRegionSwitch locale="en" initialRegion="eu"/);
  assert.match(switcher,/<CalculatorInlineDistintaExperience references=\{references\?\?\[\]\}/);
  assert.match(switcher,/internationalEuInitialValues\(internationalSeed\)/);
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
  assert.match(calculator,/setActionFeedback\(t\("Risultato copiato\."\)\)/);
  assert.match(words,/"Risultato copiato\.": "Result copied\. Paste it into your RFQ bill or an email\."/);
  assert.match(calculator,/window\.location\.assign\(locale === "it" \? "\/distinta" : `\/\$\{locale\}\/distinta`\)/);
  assert.match(calculator,/t\(onAddToDistinta \? "＋ Aggiungi alla distinta" : "Aggiungi questa misura alla distinta →"\)/);
  assert.match(words,/Add this calculation to an RFQ bill/);
  assert.match(calculator,/Aggiungi questa misura alla distinta/);
  assert.match(calculator,/t\("Copia non riuscita: controlla i permessi degli appunti\."\)/);
  assert.match(words,/Copy failed\. Check clipboard permissions\./);
  assert.match(calculator,/shareUrl\(currentSnapshot\)/);
  assert.match(words,/"Lunghezza barra": "Bar length"/);
  assert.match(words,/"Numero barre": "Number of bars"/);
});

test("I18N7 copy, favourite and RFQ CTAs enforce visible foreground under global CSS",()=>{
  assert.match(calculator,/data-cinematic-copy/);
  assert.match(calculator,/data-calc-copy-link/);
  assert.match(calculator,/data-calc-save-favorite/);
  assert.ok(cinematic.includes(".root [data-calc-copy-actions] .copy"));
  assert.ok(cinematic.includes('.root [data-calc-save-favorite][aria-pressed="true"]'));
  assert.ok(dense.includes(".detailStrip"));
  assert.match(calculator,/tube-calculator-rfq-link/);
  assert.match(css,/#calcolatore-pesi \.tube-calculator-rfq-link \{[^}]*-webkit-text-fill-color: #123b34 !important/s);
  assert.match(calculator,/locale=\{locale\}/);
});
