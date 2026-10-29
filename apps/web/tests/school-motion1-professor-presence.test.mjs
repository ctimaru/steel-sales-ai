import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const portrait = read("../public/school-professor-art1.svg");
const tutor = read("../components/school-technical-tutor.tsx");
const motion = read("../components/school-professor-presence.module.css");

test("SCHOOL-MOTION1 keeps the approved illustration and the shared public/private portrait", () => {
  assert.match(tutor, /import styles from "\.\/school-professor-presence\.module\.css"/);
  assert.match(tutor, /className=\{\x60\$\{className\} \$\{styles\.portrait\}/);
  assert.match(tutor, /state === "loading" \? styles\.consulting : ""/);
  assert.equal((tutor.match(/<TeacherPortrait state=\{state\}/g) || []).length, 2);
  assert.match(tutor, /<image href="\/school-professor-art1\.svg" width="180" height="180" \/>/);
  assert.ok(Buffer.byteLength(portrait, "utf8") < 12_000);
  assert.doesNotMatch(portrait, /<script|<animate|<foreignObject|<iframe|<image/i);
});

test("SCHOOL-MOTION1 stays CSS-only, subtle and mobile-adjusted", () => {
  assert.match(motion, /animation: professor-breathe 9s ease-in-out infinite/);
  assert.match(motion, /animation: professor-consult 1100ms ease-in-out 1/);
  assert.match(motion, /max-width: 639px/);
  assert.match(motion, /--professor-lift: -0\.8px/);
  assert.match(motion, /transform: translateY/);
  assert.doesNotMatch(motion, /filter:|box-shadow:|backdrop-filter:|transition: all/);
  assert.doesNotMatch(tutor, /requestAnimationFrame|setInterval|SpeechRecognition|speechSynthesis/);
});

test("SCHOOL-MOTION1 respects reduced motion and data preferences", () => {
  assert.match(motion, /prefers-reduced-motion: no-preference/);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /prefers-reduced-data: reduce/);
  assert.match(motion, /animation: none/);
  assert.match(motion, /transform: none/);
});
