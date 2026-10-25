import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const it = read("../app/page.tsx");
const en = read("../app/en/page.tsx");
const header = read("../components/public-home-header.tsx");
const nav = read("../components/public-home-navigation.tsx");
const language = read("../components/calculator-page-language-selector.tsx");
const hero = read("../components/public-cinematic-hero.tsx");
const workflow = read("../../../.github/workflows/perf2-1-mobile-acceptance.yml");

test("HOME-CONV1A starts with a real public calculator, not account registration", () => {
  assert.match(it, /<PublicHomeHeader locale="it" \/>/);
  assert.match(en, /<PublicHomeHeader locale="en" \/>/);
  assert.match(hero, /href=\{links\.calculator\} className=\{styles\.primary\}/);
  assert.match(hero, /href=\{links\.builder\} className=\{styles\.secondary\}/);
  assert.match(hero, /Apri calcolatrice/);
  assert.match(hero, /Open tube calculator/);
  assert.match(hero, /Crea una distinta gratis/);
  assert.match(hero, /Create a free RFQ bill/);
  assert.match(header, /source=home&surface=header#calcolatore-pesi/);
  assert.match(hero, /source=home&surface=hero#calcolatore-pesi/);
  assert.match(header, /data-home-primary-cta/);
  assert.match(header, /sticky top-0 z-40/);
  assert.match(header, /bg-\\[#071713\\] text-white/);
  assert.doesNotMatch(header, /backdrop-blur-sm|bg-\\[#071713\\]\\/95/);
  assert.match(header, /"\/en\/knowledge\/tubes"/);
  assert.match(header, /"\/knowledge\/tubes\?source=home/);
  assert.match(hero, /Strumenti pubblici senza account/);
  assert.match(it, /export const dynamic = "force-static"/);
  assert.match(en, /export const dynamic = "force-static"/);
});

test("HOME-CONV1A has a single company-area menu with both safe auth paths", () => {
  assert.match(header, /<details className="group relative">/);
  assert.match(header, /<summary aria-label=/);
  for (const path of ['"/login"', '"/register"', '"/en/login"', '"/en/register"']) {
    assert.ok(header.includes(path), "Missing company route " + path);
  }
  assert.match(header, /Area aziende/);
  assert.match(header, /Company area/);
  assert.match(header, /L'accesso aziendale richiede revisione/);
  assert.match(header, /Company access requires review/);
  assert.doesNotMatch(header, /href="\/network"|href="\/rfq-hub"|href="\/platform"/);
  assert.doesNotMatch(header, /"use client"|useEffect|useState|fetch\s*\(|createClient|onClick|<dialog|<iframe/);
});

test("HOME-CONV1A keeps five languages without giant header selectors", () => {
  assert.match(header, /surface="home" compact/);
  assert.match(language, /compact\?:boolean/);
  assert.match(language, /locale\.toUpperCase\(\)/);
  assert.match(language, /left-0 sm:left-auto sm:right-0/);
  assert.match(language, /CALCULATOR_LANGUAGE_ORDER\.map/);
  for (const route of ['it:"/"', 'en:"/en"', 'de:"/de"', 'fr:"/fr"', 'es:"/es"']) assert.ok(language.includes(route));
  assert.match(header, /<PublicHomeNavigation locale=\{locale\} theme="dark" \/>/);
});

test("HOME-CONV1A is lightweight, readable and available at all breakpoints", () => {
  assert.match(nav, /grid-cols-\[repeat\(3,minmax\(0,1fr\)\)_auto\]/);
  assert.match(nav, /xl:hidden/);
  assert.match(nav, /xl:flex/);
  for (const label of ["Distinta", "Trova aziende", "Network", "Scuola"]) assert.ok(nav.includes(label));
  assert.doesNotMatch(nav, /overflow-x-auto/);
  assert.doesNotMatch(header, /framer-motion|three|gsap|<video|<canvas|<Script/);
  assert.match(workflow, /apps\/web\/app\/\(italian\)\/\*\*/);
  assert.match(workflow, /apps\/web\/app\/\(english\)\/\*\*/);
  assert.match(read("./home-si5-chrome-visual-qa.mjs"), /HOME-CONV1A/);
  assert.match(read("./home-si5-chrome-visual-qa.mjs"), /calculator action not sticky after scroll/);
});
