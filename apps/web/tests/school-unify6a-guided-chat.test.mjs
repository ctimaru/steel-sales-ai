import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {
  parseSteelAssistantInput,mergeSteelAssistantFacts,missingSteelAssistantFields,
  schoolAssistantEvidenceCodes,schoolAssistantCalculatorUrl,
} from "../lib/school-assistant-intent.mjs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const client=read("../components/school-guided-assistant.tsx");
const privatePage=read("../app/(italian)/(workspace)/school/assistant/page.tsx");
const translations=read("../lib/school-assistant-i18n.ts");
const navigation=read("../components/school-unified-navigation.tsx");
const itHome=read("../app/(italian)/(workspace)/school/page.tsx");
const internationalHome=read("../components/school-localized-workspace-home.tsx");

test("SCHOOL-UNIFY6A extracts only known tokens and abstains from filling missing geometry",()=>{
  const parsed=parseSteelAssistantInput("Cerco 40 tubi a 3 metri EN 10219 S235");
  assert.equal(parsed.facts.standard,"en10219");
  assert.equal(parsed.facts.partialGrade,"S235");
  assert.equal(parsed.facts.grade,undefined);
  assert.equal(parsed.facts.quantityBars,40);
  assert.equal(parsed.facts.lengthM,3);
  assert.equal(parsed.facts.family,undefined);
  assert.deepEqual(parsed.codes,["en10219"]);
  const missing=missingSteelAssistantFields(parsed.facts);
  assert.ok(missing.includes("grade")&&missing.includes("family"));
  assert.equal(schoolAssistantCalculatorUrl("it",parsed.facts),null);
});

test("SCHOOL-UNIFY6A multi-turn clarification retains confirmed quantity without inventing grade",()=>{
  const initial=parseSteelAssistantInput("Cerco 40 tubi a 3 metri EN 10219 S235").facts;
  const geometry=parseSteelAssistantInput("tondi 48,3 x 3,2",initial).facts;
  let merged=mergeSteelAssistantFacts(initial,geometry);
  assert.equal(merged.family,"round_tube");
  assert.equal(merged.odMm,48.3);
  assert.equal(merged.thicknessMm,3.2);
  assert.ok(missingSteelAssistantFields(merged).includes("grade"));
  const calc=schoolAssistantCalculatorUrl("it",merged);
  assert.ok(calc?.startsWith("/knowledge/tubes?"));
  const url=new URL(calc,"https://www.smartsteelsales.com");
  assert.equal(url.searchParams.get("standard"),"en10219");
  assert.equal(url.searchParams.get("od"),"48.3");
  assert.equal(url.searchParams.get("quantity"),"40");
  assert.equal(url.searchParams.get("length"),"3");
  assert.equal(url.searchParams.get("grade"),null,"grade is deliberately NOT passed to calculator");
  merged=mergeSteelAssistantFacts(merged,parseSteelAssistantInput("S355J2H",merged).facts);
  assert.equal(merged.grade,"S355J2H");
  assert.equal(merged.partialGrade,undefined);
  assert.deepEqual(missingSteelAssistantFields(merged),[]);
});

test("SCHOOL-UNIFY6A handles section shapes and never extrapolates invalid dimensions",()=>{
  let prior=parseSteelAssistantInput("Cerco 12 tubi rettangolari EN10219").facts;
  prior=mergeSteelAssistantFacts(prior,parseSteelAssistantInput("80 x 40 x 3",prior).facts);
  assert.equal(prior.widthMm,80);assert.equal(prior.heightMm,40);assert.equal(prior.thicknessMm,3);
  const changed=mergeSteelAssistantFacts(prior,parseSteelAssistantInput("tondi",prior).facts);
  assert.equal(changed.widthMm,undefined);
  assert.equal(changed.thicknessMm,undefined);
  assert.equal(schoolAssistantCalculatorUrl("fr",{...prior,standard:"en10216-2",lengthM:3}),null);
  assert.equal(parseSteelAssistantInput("tondi 20 x 15").facts.odMm,undefined,"impossible wall thickness");
  assert.equal(parseSteelAssistantInput("quadro 50x50x3").facts.thicknessMm,3);
});

test("SCHOOL-UNIFY6A searches only identified technical codes, never forwards raw company prose",()=>{
  const input="Cerco 40 tubi EN 10219 per cliente azienda segreta";
  const extracted=parseSteelAssistantInput(input);
  assert.deepEqual(schoolAssistantEvidenceCodes(input,extracted.facts),["en10219"]);
  assert.deepEqual(schoolAssistantEvidenceCodes("48 x 3",extracted.facts),["en10219"]);
  assert.deepEqual(schoolAssistantEvidenceCodes("EN 10210 vs EN 10219",{}),["en10210","en10219"]);
  assert.deepEqual(schoolAssistantEvidenceCodes("Riservato: prezzo del cliente",{}),[]);
  assert.match(client,/q:code,locale,limit:"2"/);
  assert.match(client,/credentials:"omit"/);
  assert.doesNotMatch(client,/q:input|body:\s*JSON\.stringify\(\{.*input|localStorage|sessionStorage/);
});

test("SCHOOL-UNIFY6A five-language private UX, no fake generative AI or private-document search",()=>{
  for(const locale of ["it","en","de","fr","es"]){
    assert.ok(translations.includes(locale+":{"),"locale missing: "+locale);
  }
  assert.match(navigation,/schoolWorkspaceHref\("\/school\/professore",locale\)/);
  assert.doesNotMatch(itHome,/<SchoolAssistantEntry/);
  assert.doesNotMatch(internationalHome,/<SchoolAssistantEntry/);
  assert.match(privatePage,/privateNoIndexRobots/);
  assert.match(privatePage,/schoolWorkspaceLocale/);
  assert.match(client,/api\/public\/school-evidence/);
  assert.match(client,/schoolAssistantCalculatorUrl/);
  assert.match(client,/missingSteelAssistantFields/);
  assert.doesNotMatch(client+privatePage,/openai\.chat|generateText\(|searchKnowledge\(|supabaseAdmin|service_role|sendRf[qQ]|dispatchRf[qQ]/);
});
