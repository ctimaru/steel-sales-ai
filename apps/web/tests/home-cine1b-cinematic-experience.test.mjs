import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const hero = read("../components/public-cinematic-hero.tsx");
const css = read("../components/public-cinematic-hero.module.css");
const it = read("../app/page.tsx");
const en = read("../app/en/page.tsx");
const packageFile = JSON.parse(read("../package.json"));

test("HOME-CINE1B introduces a true cinematic progression without new runtime dependencies", () => {
  assert.match(hero, /export function PublicCinematicHero/);
  assert.match(hero, /className=\{styles\.intelligenceOverlay\}/);
  assert.match(hero, /className=\{styles\.workflowTrack\}/);
  assert.match(hero, /className=\{styles\.bridge\}/);
  assert.match(hero, /<ol className=\{styles\.bridgeSteps\}>/);
  assert.match(hero, /Distinta/);
  assert.match(hero, /Offerte/);
  assert.match(hero, /Technical knowledge/);
  assert.match(hero, /Relazioni commerciali/);
  assert.match(hero, /Illustrativo — non sono dati reali/);
  assert.match(hero, /Illustrative — not live data/);
  assert.match(it, /<PublicCinematicHero locale="it" \/>/);
  assert.match(en, /<PublicCinematicHero locale="en" \/>/);
  assert.match(it, /export const dynamic = "force-static"/);
  assert.match(en, /export const dynamic = "force-static"/);
  assert.doesNotMatch(hero, /"use client"|useEffect|useState|addEventListener|fetch\s*\(|createClient|<video|<canvas|autoplay|<iframe/i);
  assert.doesNotMatch(JSON.stringify(packageFile.dependencies), /three|gsap|framer-motion|lottie|motion\/react/i);
});

test("HOME-CINE1B motion is CSS-only, decorative, performance-scoped, and accessible", () => {
  for (const selector of [".ambient", ".intelligenceOverlay", ".networkPulse", ".productHint", ".bridgeSteps"]) {
    assert.ok(css.includes(selector), "Missing motion or bridge style " + selector);
  }
  for (const gate of [
    "@media (min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    "@media (prefers-reduced-motion: reduce)",
    "@media (prefers-reduced-data: reduce)",
    "@media (max-width: 700px)",
    "@media print",
  ]) {
    assert.ok(css.includes(gate), "Missing progressive-enhancement gate: " + gate);
  }
  assert.match(css, /background: #0c7751/);
  assert.match(css, /home-cine1a-steel\.webp/);
  assert.match(css, /transform: translate3d/);
  assert.match(css, /animation: none !important/);
  assert.doesNotMatch(css, /scroll-timeline|animation-timeline|position: fixed|background-attachment: fixed/);
  assert.doesNotMatch(css, /url\(https?:\/\//);
  const animations = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);
  assert.ok(animations.length > 0 && animations.length <= 4, "Unexpected CSS animation proliferation: " + animations.join(","));
});

test("HOME-CINE1B preserves public-first conversion and privacy boundaries", () => {
  assert.match(hero, /builder: "\/distinta"/);
  assert.match(hero, /builder: "\/en\/distinta"/);
  assert.match(hero, /register: "\/register"/);
  assert.match(hero, /register: "\/en\/register"/);
  assert.match(hero, /source=home&surface=hero#calcolatore-pesi/);
  assert.match(hero, /registrazione, verifica e abilitazione/);
  assert.match(hero, /workspaces are subject to registration, review and access permissions/);
  assert.match(hero, /aria-hidden="true"/);
  assert.match(hero, /aria-labelledby="home-cinematic-title"/);
  assert.doesNotMatch(hero, /href="\/network"|href="\/rfq-hub"|href="\/platform"|\b[0-9],[0-9]{3}\+?\b/);
});
