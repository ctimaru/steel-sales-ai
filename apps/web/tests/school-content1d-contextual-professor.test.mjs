import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  getSchoolProfessorComparison, matchSchoolProfessorComparison,
} from "../lib/school-content1d-professor.mjs";
import { schoolComparisons, SCHOOL_CONTENT1C_PATH } from "../lib/school-content1c-guides.mjs";
import { getSchoolContent1Guide } from "../lib/school-content1-guides.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const read=path=>readFileSync(root+path,"utf8");

test("SCHOOL-CONTENT1.D — route comparison questions to published copy only",()=>{
  const samples=[
    ["Qual è la differenza tra EN 10210 e EN 10219?", "en-10210-vs-en-10219"],
    ["EN-10219 vs EN 10210", "en-10210-vs-en-10219"],
    ["Che cosa significa il certificato 3.1?", "documenti-en-10204"],
    ["Quali documenti di controllo EN 10204 richiedere?", "documenti-en-10204"],
    ["Peso teorico e tolleranze del tubo", "tolleranze-peso-teorico"],
    ["Come si calcola kg/m?", "tolleranze-peso-teorico"],
    ["Differenza tra tubo saldato e seamless", "saldato-vs-seamless"],
    ["Saldato o senza saldatura?", "saldato-vs-seamless"],
  ];
  for(const [question,id] of samples) {
    const result=matchSchoolProfessorComparison(question);
    assert.equal(result?.id,id,question);
    assert.deepEqual(result,getSchoolProfessorComparison(id));
    assert.ok(result.sources.length>0);
    assert.ok(result.takeaway.length>40);
  }
  assert.equal(schoolComparisons.length,4);
  for(const entry of schoolComparisons) assert.deepEqual(getSchoolProfessorComparison(entry.id),entry);
});

test("SCHOOL-CONTENT1.D — refuse invented equivalence and arbitrary query context",()=>{
  for(const text of [
    "Quale materiale devo comprare?", "S355", "EN 10219", "S355J2H",
    "Come si producono i tubi saldati e senza saldatura?", "EN 10216-2",
    "I want my RFQ customer invoices", "123456", "ISO 10210 10219",
  ]) assert.equal(matchSchoolProfessorComparison(text),null,text);
  for(const id of ["missing","__proto__","en-10219","",null,42,"/commercial/knowledge"])
    assert.equal(getSchoolProfessorComparison(id),null,String(id));
  assert.equal(matchSchoolProfessorComparison(null),null);
  assert.equal(matchSchoolProfessorComparison("x".repeat(900)),null);
});

test("SCHOOL-CONTENT1.D — overlay references are present only for six curated K2 records",()=>{
  for(const kind of ["standard","grade"]){
    const slugs=kind==="standard" ? ["en-10210","en-10219","en-10217-1"] : ["s355j2h","s355nh","p265gh"];
    for(const slug of slugs) {
      const content=getSchoolContent1Guide(kind,slug);
      assert.ok(content?.sources.length>0,slug);
      assert.ok(content?.checks.length>=2,slug);
    }
  }
  assert.equal(getSchoolContent1Guide("standard","en-99999"),null);
  assert.equal(getSchoolContent1Guide("grade","s355"),null);
});

test("SCHOOL-CONTENT1.D — one Professor public+private, comparison CTA and calculator",()=>{
  const tutor=read("components/school-technical-tutor.tsx");
  const privatePage=read("app/(italian)/(workspace)/school/professore/page.tsx");
  const publicPage=read("app/(italian)/(public)/knowledge/professore/page.tsx");
  const comparisonPage=read("app/(italian)/(public)/knowledge/articoli/confronti-glossario/page.tsx");
  assert.match(tutor,/matchSchoolProfessorComparison\(text\)/);
  assert.match(tutor,/getSchoolContent1Guide\(item\.kind === "standards"/);
  assert.match(tutor,/x\.provenance\?\.status === "k2_published"/);
  assert.match(tutor,/data-testid="school-content1d-curated-k2"/);
  assert.match(tutor,/data-testid="school-content1d-comparison"/);
  assert.match(tutor,/SCHOOL_CONTENT1C_PATH \+ "#" \+ comparison\.id/);
  assert.match(tutor,/schoolAssistantCalculatorUrl\("it", parseSteelAssistantInput\(question\)\.facts\)/);
  assert.match(tutor,/credentials: "omit"/);
  assert.match(tutor,/cache: "no-store"/);
  assert.match(tutor,/non invia RFQ/);
  assert.doesNotMatch(tutor,/askSchoolGroundedAI|speechSynthesis|localStorage|sessionStorage|createRfq|organizationId/);
  assert.match(publicPage,/initialTopic=\{topic\}/);
  assert.match(privatePage,/initialTopic=\{params\.topic\}/);
  assert.match(publicPage,/robots: \{ index: false, follow: true \}/);
  assert.match(privatePage,/privateNoIndexRobots/);
  assert.match(comparisonPage,/knowledge\/professore\?topic=/);
  assert.ok(comparisonPage.includes("encodeURIComponent(comparison.id)"));
  assert.equal(SCHOOL_CONTENT1C_PATH,"/knowledge/articoli/confronti-glossario");
});
