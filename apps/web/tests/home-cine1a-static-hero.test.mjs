import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const hero = read("../components/public-cinematic-hero.tsx");
const css = read("../components/public-cinematic-hero.module.css");
const it = read("../app/page.tsx");
const en = read("../app/en/page.tsx");

test("HOME-CINE1A hero is shared across IT/EN and preserves static SEO", () => {
  assert.match(it, /<PublicCinematicHero locale="it" \/>/);
  assert.match(en, /<PublicCinematicHero locale="en" \/>/);
  for (const home of [it, en]) {
    assert.match(home, /export const dynamic = "force-static"/);
    assert.match(home, /<PublicHomeNavigation/);
    assert.doesNotMatch(home, /<PublicProductPreview \/>/);
  }
  assert.match(hero, /aria-labelledby="home-cinematic-title"/);
  assert.match(hero, /<h1 id="home-cinematic-title"/);
  assert.match(hero, /L’acciaio ha una/);
  assert.match(hero, /Steel has a new/);
});

test("HOME-CINE1A differentiates public utilities and gated company access", () => {
  for (const href of ['builder: "/distinta"', 'builder: "/en/distinta"', 'register: "/register"', 'register: "/en/register"', '"#network"', '"/en/network"']) {
    assert.ok(hero.includes(href), "Missing safe route: " + href);
  }
  assert.match(hero, /source=home&surface=hero#calcolatore-pesi/);
  assert.match(hero, /Strumenti pubblici senza account/);
  assert.match(hero, /Company workspaces are subject to registration/);
  assert.match(hero, /Illustrativo — non sono dati reali/);
  assert.doesNotMatch(hero, /href="\/network"|href="\/rfq-hub"|service_role|createClient|fetch\s*\(|useEffect|useState|<video/i);
});

test("HOME-CINE1A is responsive, motion-respectful and requires no binary assets", () => {
  for (const fragment of ["max-width: 980px", "max-width: 700px", "max-width: 390px", "prefers-reduced-motion: reduce", "focus-visible", "min-height: 48px"]) {
    assert.ok(css.includes(fragment), "Missing responsive/a11y contract: " + fragment);
  }
  assert.match(hero, /<svg/);
  assert.match(css, /home-cine1a-steel\\.webp/);
  assert.match(css, /background-position: 74% bottom/);
  assert.match(css, /background: #0c7751/);
  assert.doesNotMatch(hero, /next\/image|<img|<iframe|autoplay/);
  assert.doesNotMatch(hero, /src="https?:\/\/|href="https?:\/\//);
  assert.doesNotMatch(css, /url\(https?:\/\//);
});
