import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const ui = read("../components/school-ui.tsx");
const standards = read("../app/(public)/knowledge/norme/page.tsx");
const grades = read("../app/(public)/knowledge/gradi/page.tsx");
const articles = read("../app/(public)/knowledge/articoli/page.tsx");
const standardDetail = read("../app/(public)/knowledge/norme/[slug]/page.tsx");
const gradeDetail = read("../app/(public)/knowledge/gradi/[slug]/page.tsx");
const articleDetail = read("../app/(public)/knowledge/articoli/[slug]/page.tsx");

test("SCHOOL-UX3 keeps photographic editorial heroes on the three learning hubs", () => {
  assert.match(ui, /editorial\?: boolean/);
  assert.match(ui, /home-cine1a-steel\.webp/);
  assert.match(ui, /!text-\[#153f30\]/);
  for (const page of [standards, grades, articles]) {
    assert.match(page, /<SchoolHero/);
    assert.match(page, /\s+editorial\s+/);
    assert.match(page, /canonical: absoluteUrl/);
  }
});

test("SCHOOL-UX3 exposes catalog search ahead of category discovery, preserving actual datasets", () => {
  for (const [page, listFn] of [[standards, "listPublicStandards"], [grades, "listPublicGrades"]]) {
    assert.ok(page.indexOf('id="school-catalog-search"') < page.indexOf('{!query ? ('), "search comes before category cards");
    assert.match(page, /method="get" role="search"/);
    assert.match(page, /name="q"/);
    assert.match(page, new RegExp(listFn + "\\\\(query\\\\)"));
    assert.match(page, /robotsForParameterizedPage/);
    assert.match(page, /last_reviewed_at/);
    assert.match(page, /school-catalog-search/);
  }
});

test("SCHOOL-UX3 uses editorial imagery and reading layout without losing sources", () => {
  assert.match(articles, /index===0\?"lg:col-span-2/);
  assert.match(articles, /article\.visual\.src/);
  assert.match(articles, /article\.lastReviewedAt/);
  for (const page of [standardDetail, gradeDetail, articleDetail]) {
    assert.match(page, /<SchoolHero\s+reading/);
    assert.match(page, /type="application\/ld\+json"/);
  }
  assert.match(articleDetail, /aria-label="Contenuto dell’articolo"/);
  assert.match(articleDetail, /article\.sources\.map/);
  assert.match(articleDetail, /article\.sections\.map/);
});
