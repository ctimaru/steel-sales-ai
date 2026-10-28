import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/(public)/knowledge/professore/page.tsx");
const home = read("../app/(public)/knowledge/page.tsx");
const tutor = read("../components/school-technical-tutor.tsx");
const evidence = read("../app/api/public/school-evidence/route.ts");
const grounded = read("../app/(workspace)/school/assistant/grounded-ai-actions.ts");

test("SCHOOL-AI1 professor stays in public School and is intentionally noindex during pilot", () => {
  assert.match(page, /SchoolTechnicalTutor/);
  assert.match(page, /canonical: absoluteUrl\("\/knowledge\/professore"\)/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
  assert.match(home, /href="\/knowledge\/professore"/);
  assert.match(home, /Chiedi al professore/);
});

test("SCHOOL-AI1 sends only recognized technical codes to anonymous-safe published evidence", () => {
  assert.match(tutor, /parseSteelAssistantInput\(text\)\.codes\.slice\(0, 2\)/);
  assert.match(tutor, /new URLSearchParams\(\{ q: code, locale: "it", limit: "2" \}\)/);
  assert.match(tutor, /fetch\("\/api\/public\/school-evidence\?"/);
  assert.match(tutor, /credentials: "omit"/);
  assert.match(tutor, /cache: "no-store"/);
  assert.match(tutor, /AbortController/);
  assert.match(tutor, /x\.provenance\?\.status === "k2_published"/);
  assert.match(tutor, /safeUrl/);
  assert.doesNotMatch(tutor, /askSchoolGroundedAI|AI_GATEWAY_API_KEY|localStorage|sessionStorage/);
  assert.match(evidence, /retrieveSchoolTechnicalEvidence/);
  assert.match(evidence, /X-Robots-Tag/);
  assert.match(grounded, /getWorkspaceContext/);
  assert.match(grounded, /school6b_claim_ai_budget/);
});

test("SCHOOL-AI1 displays citations, limitations and existing tools without implied autonomous action", () => {
  assert.match(tutor, /item\.citations\.find/);
  assert.match(tutor, /k2LastReviewedAt/);
  assert.match(tutor, /Verifica sempre l.edizione ufficiale/);
  assert.match(tutor, /non conversazione AI generativa/);
  assert.match(tutor, /non invia RFQ/);
  assert.match(tutor, /href="\/knowledge\/norme"/);
  assert.match(tutor, /href="\/knowledge\/gradi"/);
  assert.match(tutor, /href="\/school\/assistant"/);
  assert.match(tutor, /focus-visible:outline-2/);
});

test("SCHOOL-AI1 redirects open questions to verified editorial pages, not invented answers", () => {
  const topics = read("../lib/school-tutor-topics.mjs");
  const articles = read("../lib/school-articles.ts");
  assert.match(tutor, /matchSchoolTutorTopic\(text\)/);
  assert.match(tutor, /state === "topic"/);
  for (const slug of ["come-si-producono-tubi-acciaio", "storia-tubi-acciaio", "produttori-tubi-europa"]) {
    assert.ok(topics.includes("/knowledge/articoli/" + slug));
    assert.ok(articles.includes('slug: "' + slug + '"'));
  }
  assert.doesNotMatch(topics, /AI_GATEWAY_API_KEY|generateText|fetch\(/);
});

test("SCHOOL-AI1 disabled call to action stays legible and mobile introduction stays concise", () => {
  assert.match(tutor, /disabled:bg-\[#dce8df\]/);
  assert.match(tutor, /disabled:text-\[#28543c\]/);
  assert.doesNotMatch(tutor, /disabled:opacity-50/);
  assert.match(tutor, /Partiamo insieme dalle fonti pubblicate/);
});
