import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const css = readFileSync(new URL("components/public-cinematic-hero.module.css", root), "utf8");
const hero = readFileSync(new URL("components/public-cinematic-hero.tsx", root), "utf8");
const header = readFileSync(new URL("components/public-home-header.tsx", root), "utf8");
const small = statSync(new URL("public/home-cine1a-steel.webp", root)).size;
const large = statSync(new URL("public/home-cine1e-steel-desktop.webp", root)).size;

test("HOME-CINE1E desktop sharpness has a hard image byte budget", () => {
  assert.equal(small, 6170);
  assert.equal(large, 47276);
  assert.ok(large <= 55_000, "HQ desktop poster exceeds 55KB budget");
  const riff = readFileSync(new URL("public/home-cine1e-steel-desktop.webp", root));
  assert.equal(riff.toString("ascii", 0, 4), "RIFF");
  assert.equal(riff.toString("ascii", 8, 12), "WEBP");
});

test("HOME-CINE1E keeps high-resolution photo desktop-only and honors reduced data", () => {
  assert.match(css, /@media \(min-width: 1024px\) \{\s*\.ambient \{/);
  assert.match(css, /url\('\/home-cine1e-steel-desktop\.webp'\)/);
  assert.match(css, /@media \(min-width: 1024px\) and \(prefers-reduced-data: reduce\)/);
  assert.match(css, /url\('\/home-cine1a-steel\.webp'\)/);
  assert.match(css, /background-size: cover, auto 68%, cover/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /background: #0c7751/);
});

test("HOME-CINE1E is purely decorative and preserves genuine public conversions", () => {
  assert.match(hero, /builder: "\/distinta"/);
  assert.match(hero, /builder: "\/en\/distinta"/);
  assert.match(header, /"\/register"/);
  assert.match(header, /"\/en\/register"/);
  assert.match(hero, /Illustrativo — non sono dati reali/);
  assert.doesNotMatch(hero, /"use client"|<video|autoplay|<canvas|three\.js|fetch\s*\(/i);
  assert.doesNotMatch(css, /url\(https?:\/\//);
});
