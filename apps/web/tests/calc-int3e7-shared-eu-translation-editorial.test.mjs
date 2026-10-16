import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const region=read("../components/calculator-region-switch.tsx");
const calc=read("../components/public-tube-weight-calculator.tsx");
const i18n=read("../lib/tube-calculator-locale.ts");
const dictionary=read("../lib/international-tube-calculator-copy.ts");
const install=read("../components/calculator-install-guide.tsx");
const page=read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx");
const old=read("../components/international-steel-calculator.tsx");
const seo=read("../lib/international-calculator-landing.ts");
const euBill=read("../lib/calculator-rfq-handoff.ts");

test("CALC-INT3E.7 mounts exactly one EU calculator component for IT EN DE FR ES",()=>{
  assert.match(region,/isNewCalculatorLocale\(locale\)\s*\?\s*internationalEuInitialValues\(internationalSeed\)/);
  assert.match(region,/PublicTubeWeightCalculator references=\{references\?\?\[\]\}/);
  assert.doesNotMatch(region,/<InternationalSteelCalculator/);
  assert.match(region,/UsPipeSampleCalculator locale=\{locale\}/);
  for(const literal of ["round_tube","square_tube","rectangular_tube","en10210","en10219","geometric"])
    assert.ok(region.includes(literal));
  assert.match(region,/targetTonnes:seed\.target/);
  assert.match(page,/"target"/);
  assert.match(calc,/standardCornerRadii/);
  assert.match(calc,/ParametricShapeDiagram/);
  assert.match(calc,/Barre necessarie/);
  assert.match(calc,/WC4_MAX_FAVORITES = 8/);
  assert.match(calc,/WC4_MAX_RECENTS = 6/);
  assert.match(calc,/new URLSearchParams\(\)/);
  assert.match(euBill,/sss:calc-rfq-handoff:v1/);
  assert.match(calc,/if \(locale !== "it"\) trackInternationalRfq\("handoff",locale,\{system:"eu",standard\}\)/);
  assert.match(calc,/window\.location\.assign\(locale === "it" \? "\/distinta" : \x60\/\$\{locale\}\/distinta\x60\)/);
  assert.doesNotMatch(calc,/dispatchRfq|sendSupplierEmail|supabase\.from/);
});
test("CALC-INT3E.7 static UI keys and dynamic standard/shape names translated for DE FR ES",()=>{
  const data=JSON.parse(dictionary.slice(dictionary.indexOf("= ")+2,dictionary.lastIndexOf(" as const;")));
  const staticKeys=[...new Set([...calc.matchAll(/\bt\("([^"]+)"\)/g)].map(m=>m[1]))];
  for(const locale of ["de","fr","es"]){
    assert.ok(staticKeys.length>=70,"Coverage needs actual full cockpit strings");
    for(const key of staticKeys){
      assert.ok(Object.hasOwn(data[locale],key),"Missing "+locale+" "+key);
      assert.ok(data[locale][key].length>=2,locale+" "+key);
    }
    for(const key of ["Tubo tondo","Profilo quadro","Profilo rettangolare","Profilati cavi formati a freddo",
      "Profilati cavi finiti a caldo","Calcolo libero","Vista proporzionale",
      "Calcolatore salvato ✓","Ultimi calcoli e preferiti","Opzioni del dispositivo",
      "Aggiungi questa misura alla distinta →","Gratuito · nessun login richiesto. Il grado acciaio resta da confermare."]){
      assert.ok(data[locale][key]&&!data[locale][key].includes("Aggiungi alla distinta"),locale+" "+key);
    }
  }
  assert.match(i18n,/"it" \| "en" \| "de" \| "fr" \| "es"/);
  assert.match(i18n,/internationalTubeCalculatorCopy\[locale\]/);
  assert.match(install,/tubeCalculatorText\(value,locale\)/);
  assert.match(calc,/de:"de-DE",fr:"fr-FR",es:"es-ES"/);
});
test("CALC-INT3E.7 localized editorial compact and factual, no IT article list rendered",()=>{
  assert.match(page,/copy\.methodTitle/);
  assert.match(page,/copy\.methodText/);
  assert.match(page,/copy\.usTitle/);
  assert.match(page,/copy\.faqTitle/);
  assert.match(page,/<details/);
  assert.match(page,/copy\.faq\.map/);
  assert.doesNotMatch(page,/Articoli|Leggi tutti|\/knowledge\/articoli|schoolArticles/);
  assert.match(page,/robotsForParameterizedPage\(hasParameters\)/);
  assert.match(page,/localizedHrefLangPaths\(\)/);
  assert.match(seo,/CALCULATOR_TRANSLATIONS/);
  assert.match(calc,/references\.length > 0/);
  assert.doesNotMatch(region,/<InternationalSteelCalculator/);
  assert.match(old,/export type InternationalCalculatorSeed/); // legacy deep link type, not mounted
});
