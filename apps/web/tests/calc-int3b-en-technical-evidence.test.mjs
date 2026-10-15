import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const src=read("../lib/en-structural-technical-evidence.ts");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const e=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const c=read("../components/en-structural-method-evidence.tsx");
const it=read("../app/(public)/knowledge/tubes/page.tsx");
const en=read("../app/en/knowledge/tubes/page.tsx");
const mass=read("../lib/international-tube-mass.ts");
const rfq=read("../lib/calculator-rfq-handoff.ts");
test("CALC-INT3B keeps edition-labelled publisher evidence for both normative calculation methods",()=>{
  assert.deepEqual(Object.keys(e.STRUCTURAL_EVIDENCE),["en10219","en10210"]);
  assert.equal(e.safeStructuralEvidence("en10219").partTwo,"EN 10219-2:2019");
  assert.equal(e.safeStructuralEvidence("en10210").partTwo,"EN 10210-2:2019");
  assert.equal(e.safeStructuralEvidence("api5l"),null);
  for(const value of Object.values(e.STRUCTURAL_EVIDENCE)){
    assert.deepEqual(Object.values(value.sourceClaims),[true,true,true,true,true]);
    assert.ok(value.publisherReferenceUrl.startsWith("https://"));
    assert.match(value.noteEn,/not|require/i);
  }
});
test("CALC-INT3B separates theoretical, manufacturer-published and source-reviewed masses",()=>{
  assert.notEqual(e.massEvidenceLabel("theoretical-nominal","en"),e.massEvidenceLabel("manufacturer-published","en"));
  assert.notEqual(e.massEvidenceLabel("manufacturer-published","it"),e.massEvidenceLabel("source-verified","it"));
  assert.match(c,/source-verified/);
  assert.match(c,/calculated mass|nominal theoretical mass|theoretical mass/i);
});
test("CALC-INT3B unchanged SEO and RFQ, unchanged EN nominal radii equations",()=>{
  assert.match(it,/<EnStructuralMethodEvidence locale="it"/);
  assert.match(en,/<EnStructuralMethodEvidence locale="en"/);
  assert.match(it,/canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(en,/canonical: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  assert.match(it,/robotsForParameterizedPage\(hasParameters\)/);
  assert.match(en,/robotsForParameterizedPage\(hasParameters\)/);
  assert.match(mass,/outerRadiusMm: 1\.5 \* thicknessMm/);
  assert.match(mass,/outerRadiusMm: 2\.0 \* thicknessMm/);
  assert.match(rfq,/CALC_RFQ_HANDOFF_KEY = "sss:calc-rfq-handoff:v1"/);
  assert.doesNotMatch(src+c,/fetch\(|createClient\(|service_role|sessionStorage/);
});
