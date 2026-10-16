import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const calculator=read("../components/public-tube-weight-calculator.tsx");
const itEn=read("../lib/tube-calculator-locale.ts");
const translated=read("../lib/international-tube-calculator-copy.ts");
const landing=read("../lib/international-calculator-landing.ts");

test("CALC-INT3E.7 production final polish: no obsolete flags or untranslated thickness assist",()=>{
  assert.match(calculator,/t\("Spessori suggeriti"\)/);
  assert.doesNotMatch(calculator,/>\s*Assist \{currentStandard.label\}/);
  assert.match(itEn,/"Spessori suggeriti": "Suggested thicknesses"/);
  const data=JSON.parse(translated.slice(translated.indexOf("= ")+2,translated.lastIndexOf(" as const;")));
  for(const locale of ["de","fr","es"]){
    assert.ok(data[locale]["Spessori suggeriti"]?.length>6);
    assert.notEqual(data[locale]["Spessori suggeriti"],"Spessori suggeriti");
  }
  assert.doesNotMatch(landing,/🇺🇸|🇪🇺/);
  assert.match(landing,/Europa \/ USA/);
  assert.match(landing,/Europe \/ USA/);
});
