import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");
const standards = fs.readFileSync(new URL("../app/(public)/knowledge/norme/page.tsx", import.meta.url), "utf8");
const grades = fs.readFileSync(new URL("../app/(public)/knowledge/gradi/page.tsx", import.meta.url), "utf8");
const publicLayout = fs.readFileSync(new URL("../app/(public)/knowledge/layout.tsx", import.meta.url), "utf8");

test("SCHOOL-GROWTH1A keeps public SEO URL, translations and indexable shell", () => {
  assert.match(page, /canonical: absoluteUrl\("\/knowledge"\)/);
  assert.match(page, /en: absoluteUrl\("\/en\/knowledge"\)/);
  assert.match(publicLayout, /index: true/);
  assert.match(page, /La Scuola di Smart Steel Sales/);
});

test("SCHOOL-GROWTH1A exposes real searchable catalogues without inventing AI results", () => {
  assert.match(page, /<form action="\/knowledge\/norme" method="get"/);
  assert.match(page, /<form action="\/knowledge\/gradi" method="get"/);
  assert.match(page, /name="q" type="search" required/);
  assert.match(standards, /listPublicStandards\(query\)/);
  assert.match(grades, /listPublicGrades\(query\)/);
  assert.doesNotMatch(page, /chatbot|AI-powered search|assistant generating/);
});

test("SCHOOL-GROWTH1A renders articles visibly with server-side semantic headings", () => {
  assert.match(page, /id="school-articles-heading"/);
  assert.match(page, /schoolArticles\.slice\(0, 3\)\.map/);
  assert.match(page, /<h3 className=/);
  assert.doesNotMatch(page, /<details[^>]*>[\s\S]*schoolArticles\.slice\(0, 3\)/);
});

test("SCHOOL-GROWTH1A preserves conversion, trust and Network privacy", () => {
  assert.match(page, /source=school&surface=home_card#calcolatore-pesi/);
  assert.match(page, /Calcola e crea la distinta/);
  assert.match(page, /La Scuola distingue contenuti editoriali/);
  assert.doesNotMatch(page, /href="\/network/);
  assert.doesNotMatch(page, /<img[^>]+src="https?:/);
});

test("SCHOOL-GROWTH1A uses the shared high-contrast action contract and a lightweight schematic", () => {
  assert.match(page, /school-primary-action/);
  assert.match(page, /school-secondary-action/);
  assert.match(page, /home-cine1a-steel\\.webp/);
  assert.match(page, /SchoolJourney locale="it"/);
  assert.match(page, /focus-visible:outline-2/);
});
