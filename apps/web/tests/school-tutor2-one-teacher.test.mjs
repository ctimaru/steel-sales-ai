import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const tutor = read("../components/school-technical-tutor.tsx");
const privatePage = read("../app/(italian)/(workspace)/school/professore/page.tsx");
const publicPage = read("../app/(italian)/(public)/knowledge/professore/page.tsx");
const legacyAssistant = read("../app/(italian)/(workspace)/school/assistant/page.tsx");
const home = read("../components/school-workspace-first-viewport.tsx");
const articles = read("../lib/school-tutor-topics.mjs");

test("SCHOOL-TUTOR2 presents one professor journey in both public/private School", () => {
  assert.match(privatePage, /<SchoolTechnicalTutor/);
  assert.match(publicPage, /<SchoolTechnicalTutor/);
  assert.match(home, /data-testid="school-ux6-professor-entry"/);
  assert.equal((tutor.match(/id="school-professor-title"/g)||[]).length, 1);
  assert.match(tutor, /Consultazione guidata · Fonti pubblicate K2/);
  assert.match(tutor, /viewBox="0 0 180 180"/);
  assert.match(tutor, /Ciao, cosa vuoi capire\?/);
  assert.doesNotMatch(tutor, /href="\/school\/assistant"|Apri l.assistente aziendale/);
  // Do not delete or activate experimental capabilities; legacy guarded route remains.
  assert.match(legacyAssistant, /SCHOOL6B_AI_ENABLED/);
  assert.match(legacyAssistant, /SCHOOL6B_VOICE_ENABLED/);
});

test("SCHOOL-TUTOR2 gives readable, progressively disclosed published-source answers", () => {
  assert.match(tutor, /In breve · Riferimento pubblicato/);
  assert.match(tutor, /Approfondisci il contesto tecnico/);
  assert.match(tutor, /item\.technicalContext\.slice\(0, 500\)/);
  assert.match(tutor, /item\.citations\.find/);
  assert.match(tutor, /k2LastReviewedAt/);
  assert.match(tutor, /Verifica sempre l.edizione ufficiale/);
  assert.match(tutor, /non invia RFQ/);
  for (const route of ["/knowledge/norme","/knowledge/gradi","/knowledge/tubes"]) {
    assert.ok(tutor.includes(route),route+" contextual learning/tool link missing");
  }
});

test("SCHOOL-TUTOR2 no model activation, private retrieval or raw question transport", () => {
  assert.match(tutor, /parseSteelAssistantInput\(text\)\.codes\.slice\(0, 2\)/);
  assert.match(tutor, /new URLSearchParams\(\{ q: code, locale: "it", limit: "2" \}\)/);
  assert.match(tutor, /credentials: "omit"/);
  assert.match(tutor, /cache: "no-store"/);
  assert.match(tutor, /x\.provenance\?\.status === "k2_published"/);
  assert.match(tutor, /matchSchoolTutorTopic\(text\)/);
  assert.match(tutor, /AbortController/);
  assert.doesNotMatch(tutor, /askSchoolGroundedAI|AI_GATEWAY_API_KEY|searchKnowledge|organizationId|service_role|localStorage|sessionStorage/);
  assert.doesNotMatch(articles, /generateText|AI_GATEWAY_API_KEY|searchKnowledge/);
  assert.match(privatePage, /privateNoIndexRobots/);
  assert.match(publicPage, /robots: \{ index: false, follow: true \}/);
});
