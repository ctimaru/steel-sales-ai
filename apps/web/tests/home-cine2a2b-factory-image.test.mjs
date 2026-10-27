import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const css = readFileSync(new URL("components/public-cinematic-hero.module.css", root), "utf8");
const hero = readFileSync(new URL("components/public-cinematic-hero.tsx", root), "utf8");
const d = new URL("public/home-cine2a2b-factory-desktop.webp", root);
const m = new URL("public/home-cine2a2b-factory-mobile.webp", root);

test("CINE2A.2B image assets are valid and within performance budgets", () => {
  assert.equal(statSync(d).size, 79680);
  assert.equal(statSync(m).size, 10714);
  assert.ok(statSync(d).size <= 80000);
  assert.ok(statSync(m).size <= 15000);
  for (const file of [d,m]) {
    const bytes=readFileSync(file);
    assert.equal(bytes.toString("ascii",0,4), "RIFF");
    assert.equal(bytes.toString("ascii",8,12), "WEBP");
  }
});
test("CINE2A.2B selects distinct factory images responsively", () => {
  assert.match(css, /@media \(min-width: 701px\)/);
  assert.match(css, /url\('\/home-cine2a2b-factory-desktop\.webp'\)/);
  assert.match(css, /url\('\/home-cine2a2b-factory-mobile\.webp'\)/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(prefers-reduced-data: reduce\)/);
  assert.match(css, /url\('\/home-cine1a-steel\.webp'\)/);
  assert.doesNotMatch(css, /url\(https?:\/\//);
});
test("CINE2A.2B photo cannot replace working HTML calculator or invent measures", () => {
  assert.match(hero, /href=\{links\.calculator\} className=\{styles\.primary\}/);
  assert.match(hero, /href=\{links\.builder\} className=\{styles\.secondary\}/);
  assert.doesNotMatch(hero, /href=\{links\.calculator\} className=\{styles\.hintCta\}/);
  assert.match(hero, /Illustrativo — non sono dati reali/);
  assert.doesNotMatch(hero, /<video|<canvas|<iframe|useState\(|useEffect\(/);
});
