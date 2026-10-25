import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const hero = read("../components/public-cinematic-hero.tsx");
const css = read("../components/public-cinematic-hero.module.css");
const continuity = read("../components/public-cinematic-continuity.module.css");
const it = read("../app/page.tsx");
const en = read("../app/en/page.tsx");

test("HOME-CINE1D gives realistic steel room without changing the already optimized poster", () => {
  const source = fs.statSync(new URL("../public/home-cine1a-steel.webp", import.meta.url));
  assert.ok(source.size <= 7000, "Poster grew unexpectedly; assess image bytes and LCP separately");
  assert.match(css, /home-cine1a-steel\.webp'\) right 48% \/ auto 88% no-repeat/);
  assert.match(css, /background-size: cover, auto 70%, cover/);
  assert.match(css, /background-size: cover, auto 68%, cover/);
  assert.match(css, /background-position: center, 74% bottom, center/);
  assert.match(css, /min-height: 660px/);
  assert.match(css, /min-height: 764px/);
  assert.match(css, /min-height: 790px/);
  assert.match(css, /font-size: clamp\(3\.2rem, 5\.35vw, 5\.35rem\)/);
  assert.match(css, /max-width: 575px/);
  assert.match(css, /width: 242px/);
  assert.match(css, /min-height: 76px/);
  assert.match(css, /background: #0c7751/);
  assert.match(css, /min-height: 48px/);
});

test("HOME-CINE1D preserves truthful workflow and public-first bilingual CTAs", () => {
  assert.match(it, /<PublicCinematicHero locale="it" \/>/);
  assert.match(en, /<PublicCinematicHero locale="en" \/>/);
  assert.match(hero, /builder: "\/distinta"/);
  assert.match(hero, /builder: "\/en\/distinta"/);
  assert.match(hero, /register: "\/register"/);
  assert.match(hero, /register: "\/en\/register"/);
  assert.match(hero, /Illustrativo — non sono dati reali/);
  assert.match(hero, /Illustrative — not live data/);
  assert.match(hero, /registrazione, verifica e abilitazione/);
  assert.match(hero, /Company workspaces are subject to registration, review and access permissions/);
  assert.doesNotMatch(hero, /"use client"|useEffect|useState|<video|<canvas|autoplay|fetch\s*\(|href="\/network"|href="\/rfq-hub"/);
});

test("HOME-CINE1D keeps motion optional and downstream product proof compact", () => {
  for (const gate of ["prefers-reduced-motion: reduce", "prefers-reduced-data: reduce", "max-width: 700px", "max-width: 390px"]) {
    assert.ok(css.includes(gate), "Missing motion or responsive safety: " + gate);
  }
  assert.match(continuity, /padding: 48px 32px/);
  assert.match(continuity, /font-size: clamp\(26px, 3vw, 39px\)/);
  assert.match(continuity, /border-top: 2px solid #13764c/);
  assert.match(continuity, /\.networkSection/);
  assert.match(continuity, /\.trustSection/);
  assert.match(continuity, /\.proofPanel/);
  assert.doesNotMatch(continuity, /@keyframes|animation:|backdrop-filter|url\(https?:\/\//);
  assert.doesNotMatch(css, /url\(https?:\/\//);
});
