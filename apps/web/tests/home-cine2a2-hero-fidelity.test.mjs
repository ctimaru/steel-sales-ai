import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const hero = read("../components/public-cinematic-hero.tsx");
const css = read("../components/public-cinematic-hero.module.css");
const header = read("../components/public-home-header.tsx");

test("CINE2A.2 photograph and geographic network remain separate from live product UI", () => {
  assert.match(hero, /className=\{styles\.globe\}/);
  for (const name of ["orbitCompany", "orbitKnowledge", "orbitOpportunity"]) {
    assert.ok(hero.includes(name), "Missing grounded network topic " + name);
  }
  assert.match(hero, /className=\{styles\.intelligenceOverlay\}[^\n]*aria-hidden="true"/);
  assert.match(css, /background-size: cover, auto 112%, cover/);
  assert.match(css, /\.intelligenceOverlay, \.productHint \{ display: none; \}/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-reduced-data: reduce/);
});

test("CINE2A.2 product proof links to the actual public calculator and shows no fake weights", () => {
  assert.match(hero, /<aside className=\{styles\.productHint\}/);
  assert.match(hero, /href=\{links\.calculator\} className=\{styles\.hintCta\}/);
  assert.match(hero, /href=\{links\.calculator\} className=\{styles\.primary\}/);
  assert.match(hero, /href=\{links\.builder\} className=\{styles\.secondary\}/);
  assert.match(hero, /CHS · SHS · RHS/);
  assert.match(hero, /Illustrativo — non sono dati reali/);
  assert.match(hero, /Illustrative — not live data/);
  assert.match(hero, /Company workspaces are subject to registration/);
  assert.match(header, /data-home-primary-cta/);
  assert.doesNotMatch(hero, /10,000\+|100\+|31\.51\s*kg|168\.3\s*mm|8\.0\s*mm|<iframe|<video|<canvas|useEffect|useState|fetch\s*\(/i);
  assert.doesNotMatch(css, /url\(https?:\/\//);
  assert.ok(statSync(new URL("../public/home-cine1e-steel-desktop.webp", import.meta.url)).size <= 55_000);
});
