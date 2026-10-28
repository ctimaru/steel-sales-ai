import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const italianPublic = read("../app/(italian)/(public)/knowledge/page.tsx");
const englishPublic = read("../app/(english)/en/knowledge/page.tsx");
const internationalPublic = read("../app/(international-calculator)/[locale]/knowledge/page.tsx");
const italianPrivate = read("../app/(italian)/(workspace)/school/page.tsx");
const internationalPrivate = read("../components/school-localized-workspace-home.tsx");
const sharedPrivateHero = read("../components/school-workspace-first-viewport.tsx");

test("SCHOOL-CINE1 keeps a consistent first-viewport identity on public and private school", () => {
  for (const [name, page] of Object.entries({ italianPublic, englishPublic, internationalPublic, sharedPrivateHero })) {
    assert.match(page, /bg-\[#102921\]/, name);
    assert.match(page, /text-white/, name);
    assert.match(page, /SchoolTechnicalSections|CHS|rounded-\[55px\]|school-private-calculator-heading/, name);
  }
  for (const [name, page] of Object.entries({ italianPrivate, internationalPrivate })) {
    assert.match(page, /SchoolUnifiedNavigation/, name);
    assert.match(page, /SchoolWorkspaceFirstViewport/, name);
    assert.match(page, /SchoolTechnicalSections/, name);
  }
});

test("SCHOOL-CINE1 preserves public editorial routes and private boundaries", () => {
  assert.match(italianPublic, /href="#ricerca-tecnica"/);
  assert.match(italianPublic, /id="ricerca-tecnica"/);
  assert.match(italianPublic, /href="\/knowledge\/professore"/);
  assert.match(italianPublic, /id="approfondimenti"/);
  assert.match(englishPublic, /\/en\/knowledge\/tubes/);
  assert.match(internationalPublic, /generateStaticParams/);
  assert.match(internationalPublic, /isNewCalculatorLocale/);
  assert.match(italianPrivate, /SchoolAssistantEntry/);
  assert.match(internationalPrivate, /schoolWorkspaceHref/);
  assert.doesNotMatch(internationalPublic, /href="\/school\/explorer"/);
});

test("SCHOOL-CINE1G reuses a local industrial photo across five School surfaces", () => {
  for (const [name, page] of Object.entries({ italianPublic, englishPublic, internationalPublic, sharedPrivateHero })) {
    assert.match(page, /home-cine1a-steel\.webp/, name);
    assert.match(page, /pointer-events-none absolute inset-0/, name);
  }
  for (const page of [italianPrivate, internationalPrivate]) assert.match(page, /SchoolWorkspaceFirstViewport/);
});
