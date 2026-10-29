import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const tutor = read("../components/school-technical-tutor.tsx");
const professor = read("../app/(italian)/(workspace)/school/professore/page.tsx");
const publicProfessor = read("../app/(italian)/(public)/knowledge/professore/page.tsx");
const commercial = read("../app/(italian)/(workspace)/commercial/knowledge/page.tsx");
const evidence = read("../app/api/public/school-evidence/route.ts");

test("SCHOOL-TUTOR3 expression responds to state without voice, animation overload or extra avatar services", () => {
  assert.match(tutor, /data-testid="school-tutor3-presence"/);
  assert.match(tutor, /state === "loading" \? "Consulto le fonti/);
  assert.match(tutor, /state === "ready" \? "Ho trovato le fonti"/);
  assert.match(tutor, /state === "loading"\s*\?\s*<path/);
  assert.match(tutor, /motion-safe:animate-pulse/);
  assert.equal((tutor.match(/id="school-professor-title"/g) || []).length, 1);
  assert.match(professor, /<SchoolTechnicalTutor/);
  assert.match(publicProfessor, /<SchoolTechnicalTutor/);
  assert.doesNotMatch(tutor, /SpeechRecognition|speechSynthesis|video autoplay|requestAnimationFrame/);
});

test("SCHOOL-TUTOR3 contextual follow-up is grounded in the same verified K2 record and resets on new question", () => {
  assert.match(tutor, /type GuidedFollowUp = \{ evidenceId: string; kind: "context" \| "caution" \}/);
  assert.match(tutor, /setFollowUp\(null\)/);
  assert.match(tutor, /data-testid="school-tutor3-guided-followups"/);
  assert.match(tutor, /data-testid="school-tutor3-grounded-followup"/);
  assert.match(tutor, /Approfondisci il contesto tecnico/);
  assert.match(tutor, /Che cosa devo verificare\?/);
  assert.match(tutor, /item\.technicalContext\.slice\(0, 500\)/);
  assert.match(tutor, /item\.caution\.slice\(0, 260\)/);
  assert.match(tutor, /aria-expanded=\{selected\}/);
  assert.match(tutor, /aria-controls=\{selected \?/);
  assert.match(tutor, /x\.provenance\?\.status === "k2_published"/);
  assert.match(tutor, /item\.citations\.find/);
  assert.match(tutor, /safeUrl/);
  assert.match(evidence, /retrieveSchoolTechnicalEvidence/);
});

test("SCHOOL-TUTOR3 continuity stays editorial and never turns answers into a commercial transaction", () => {
  assert.match(tutor, /data-testid="school-tutor3-next-steps"/);
  assert.match(tutor, /Continua il tuo percorso/);
  for (const route of ["/knowledge/norme", "/knowledge/gradi", "/knowledge/tubes"]) {
    assert.ok(tutor.includes(route), route + " one-click technical handoff");
  }
  assert.match(tutor, /non invia RFQ/);
  assert.doesNotMatch(tutor, /href="\/school\/assistant"/);
  assert.match(commercial, /KnowledgeExplorer/);
  assert.match(tutor, /parseSteelAssistantInput\(text\)\.codes\.slice\(0, 2\)/);
  assert.match(tutor, /new URLSearchParams\(\{ q: code, locale: "it", limit: "2" \}\)/);
  assert.match(tutor, /credentials: "omit"/);
  assert.doesNotMatch(tutor, /askSchoolGroundedAI|searchKnowledge|AI_GATEWAY_API_KEY|school6b_claim_ai_budget|createRfq|createBill|organizationId/);
  assert.match(professor, /privateNoIndexRobots/);
  assert.match(publicProfessor, /robots: \{ index: false, follow: true \}/);
});
