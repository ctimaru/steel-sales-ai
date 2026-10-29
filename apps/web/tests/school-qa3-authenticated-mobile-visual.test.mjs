import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const tutor = read("../components/school-technical-tutor.tsx");
const privateProfessor = read("../app/(italian)/(workspace)/school/professore/page.tsx");
const home = read("../app/(italian)/(workspace)/school/page.tsx");
const workspace = read("../components/school-workspace-first-viewport.tsx");
const existingTutorTest = read("./school-tutor3-natural-teacher.test.mjs");

test("SCHOOL-QA3 — the same teacher illustration is now visible on mobile and desktop", () => {
  assert.match(tutor, /function TeacherPortrait\(\{ state, className \}/);
  assert.match(tutor, /data-testid="school-qa3-mobile-portrait"/);
  assert.match(tutor, /sm:hidden/);
  assert.match(tutor, /<TeacherPortrait state=\{state\} className="h-\[72px\] w-\[72px\] shrink-0 translate-y-1"\/>/);
  assert.match(tutor, /<TeacherPortrait state=\{state\} className="h-\[155px\] w-\[155px\]"\/>/);
  assert.match(tutor, /motion-safe:animate-pulse/);
  assert.doesNotMatch(tutor, /new Image\(|SpeechRecognition|speechSynthesis|requestAnimationFrame/);
});

test("SCHOOL-QA3 — initial prompts occupy less space while the complete set stays reachable", () => {
  assert.match(tutor, /examples\.slice\(0, 2\)\.map/);
  assert.match(tutor, /examples\.slice\(2\)\.map/);
  assert.match(tutor, /data-testid="school-qa3-more-questions"/);
  assert.match(tutor, /Altre domande/);
  assert.match(tutor, /min-h-10 rounded-full/);
  assert.match(tutor, /px-5 py-5 text-white sm:px-8 sm:py-9/);
});

test("SCHOOL-QA3 — private page has mobile dock clearance; technical evidence and private-data boundaries are intact", () => {
  assert.match(privateProfessor, /pb-\[calc\(8rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(privateProfessor, /sm:px-5 sm:py-4/);
  assert.match(privateProfessor, /<SchoolTechnicalTutor\/>/);
  assert.match(home, /<SchoolWorkspaceFirstViewport locale="it"/);
  assert.match(workspace, /schoolWorkspaceHref\("\/school\/professore",locale\)/);
  assert.match(tutor, /credentials: "omit"/);
  assert.match(tutor, /x\.provenance\?\.status === "k2_published"/);
  assert.match(tutor, /parseSteelAssistantInput\(text\)\.codes\.slice\(0, 2\)/);
  assert.match(tutor, /data-testid="school-tutor3-grounded-followup"/);
  assert.match(existingTutorTest, /no model activation|no additional request|follow-up|source/i);
  assert.doesNotMatch(tutor, /searchKnowledge|organizationId|AI_GATEWAY_API_KEY|createRfq|supabaseAdmin/);
});
