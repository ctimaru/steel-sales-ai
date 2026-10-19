import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const evidence = read("../lib/school-knowledge-evidence.ts");
const route = read("../app/api/public/school-evidence/route.ts");
const italian = read("../lib/public-knowledge.ts");
const english = read("../lib/international-steel-knowledge.ts");
const market = read("../lib/localized-steel-knowledge.ts");

test("SCHOOL-UNIFY5 always gates by published anonymous K2 listing and detail", () => {
  assert.match(evidence, /listPublicStandards\(\), listPublicGrades\(\)/);
  assert.match(evidence, /getPublicStandard\(item\.slug\)/);
  assert.match(evidence, /getPublicGrade\(item\.slug\)/);
  assert.match(evidence, /if \(!detail\) continue/);
  assert.match(evidence, /if \(!editorial\) continue/);
  assert.match(italian, /k2_public_knowledge_standard/);
  assert.match(italian, /k2_public_knowledge_grade/);
  assert.doesNotMatch(evidence + route, /service_role|supabaseAdmin|private_docs|company_documents|searchKnowledge\(/);
});

test("SCHOOL-UNIFY5 one evidence schema and real five-language editorial sources", () => {
  assert.match(evidence, /"it", "en", "de", "fr", "es"/);
  assert.match(evidence, /englishStandardForSlug/);
  assert.match(evidence, /englishGradeForSlug/);
  assert.match(evidence, /localizedKnowledgeGuide\(locale, kind, slug\)/);
  assert.match(evidence, /record\.source_references/);
  assert.match(evidence, /k2LastReviewedAt/);
  assert.match(evidence, /editorialPreparedAt/);
  assert.match(evidence, /reviewRequired: true/);
  assert.match(evidence, /relatedForDiscovery/);
  assert.match(evidence, /TECHNICAL_RELATED_SLUGS\[kind\]\[slug\]/);
  for (const loc of ['"de"', '"fr"', '"es"']) assert.ok(market.includes(loc + ": {"), loc);
  assert.match(english, /englishStandards/);
});

test("SCHOOL-UNIFY5 API is bounded, noindex, not an AI answer or RFQ write", () => {
  assert.match(evidence, /const MAX_RESULTS = 4/);
  assert.match(evidence, /const MAX_QUERY_LENGTH = 100/);
  assert.match(evidence, /\^\[1-4\]\$/);
  assert.match(evidence, /query\.length < 2/);
  assert.match(evidence, /Math\.min\(MAX_RESULTS/);
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function POST/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(route, /X-Robots-Tag": "noindex, nofollow"/);
  assert.match(route, /answerableFromVerifiedSources: evidence\.length > 0/);
  assert.match(route, /neverInferNormativeEquivalence: true/);
  assert.match(route, /neverAssertProductCertification: true/);
  assert.match(route, /humanReviewBeforeRFQOrOrder: true/);
  assert.doesNotMatch(evidence + route, /openai\.chat|generateText\(|embedding\(|createOrder\(|dispatchRFQ\(/);
});
