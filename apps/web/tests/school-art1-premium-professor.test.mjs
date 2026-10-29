import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const portrait = read("../public/school-professor-art1.svg");
const tutor = read("../components/school-technical-tutor.tsx");
const qa3 = read("./school-qa3-authenticated-mobile-visual.test.mjs");

test("SCHOOL-ART1 illustration is a lightweight local vector, not an animated or external avatar", () => {
  assert.ok(Buffer.byteLength(portrait, "utf8") < 12_000, "portrait budget: 12KB source");
  assert.match(portrait, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 180 180"/);
  for (const detail of ["radialGradient", "linearGradient", "clipPath", 'id="art-skin"', 'id="art-hair"', 'id="art-suit"']) {
    assert.ok(portrait.includes(detail), "premium illustration detail " + detail);
  }
  assert.doesNotMatch(portrait, /<script|<animate|<foreignObject|<iframe|<image|https?:\/\//i);
  assert.doesNotMatch(portrait, /onload=|onclick=|javascript:/i);
});

test("SCHOOL-ART1 retains a single professor layout on desktop and mobile with three restrained states", () => {
  assert.match(tutor, /function TeacherPortrait\(\{ state, className \}/);
  assert.match(tutor, /<image href="\/school-professor-art1\.svg" width="180" height="180" \/>/);
  assert.equal((tutor.match(/<TeacherPortrait state=\{state\}/g) || []).length, 2);
  assert.match(tutor, /state === "loading"\s*\? <path/);
  assert.match(tutor, /state === "ready" \|\| state === "topic"/);
  assert.match(tutor, /data-testid="school-qa3-mobile-portrait"/);
  assert.match(tutor, /<TeacherPortrait state=\{state\} className="h-\[72px\] w-\[72px\] shrink-0 translate-y-1"\/>/);
  assert.match(tutor, /<TeacherPortrait state=\{state\} className="h-\[155px\] w-\[155px\]"\/>/);
  assert.match(tutor, /Come posso aiutarti\?/);
  assert.match(qa3, /fixed workspace dock|dock clearance|safe-area/);
});

test("SCHOOL-ART1 leaves published K2 boundaries, question flow and navigation untouched", () => {
  assert.match(tutor, /x\.provenance\?\.status === "k2_published"/);
  assert.match(tutor, /parseSteelAssistantInput\(text\)\.codes\.slice\(0, 2\)/);
  assert.match(tutor, /credentials: "omit"/);
  assert.match(tutor, /data-testid="school-tutor3-grounded-followup"/);
  assert.doesNotMatch(tutor, /SpeechRecognition|speechSynthesis|AI_GATEWAY_API_KEY|createRfq|supabaseAdmin|organizationId/);
});
