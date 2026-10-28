import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const nav = read("../components/school-reading-index.tsx");
const article = read("../app/(public)/knowledge/articoli/[slug]/page.tsx");
const standard = read("../app/(public)/knowledge/norme/[slug]/page.tsx");
const grade = read("../app/(public)/knowledge/gradi/[slug]/page.tsx");
const englishStandard = read("../app/(english)/en/knowledge/standards/[slug]/page.tsx");
const englishGrade = read("../app/(english)/en/knowledge/grades/[slug]/page.tsx");
const intl = read("../app/(international-calculator)/[locale]/knowledge/[kind]/[slug]/page.tsx");

test("SCHOOL-UX5 accessible five-language anchor-only reading navigation", () => {
  for (const locale of ["it", "en", "de", "fr", "es"]) assert.ok(nav.includes(locale + ": {"));
  assert.ok(nav.includes("aria-label={t.eyebrow}"));
  assert.ok(nav.includes("href={"));
  assert.ok(nav.includes("focus-visible:outline-2"));
  assert.ok(nav.includes("if (entries.length < 2) return null"));
  assert.doesNotMatch(nav, /use client|localStorage|fetch\(/);
  assert.doesNotMatch(nav, /role="listitem"/);
});

test("SCHOOL-UX5 Italian index anchors exist on real sections", () => {
  assert.ok(article.includes('<SchoolReadingIndex locale="it"'));
  assert.ok(article.includes("article.sections.map((section, index)"));
  assert.ok(article.includes("article-section-"));
  assert.ok(article.includes("article-sources"));
  for (const [source, subject] of [[standard, "standard"], [grade, "grade"]]) {
    assert.ok(source.includes('<SchoolReadingIndex locale="it"'));
    assert.ok(source.includes(subject + "-reading-main"));
    assert.ok(source.includes(subject + "-reading-section-"));
    assert.ok(source.includes(subject + ".editorial_sections.map((section, index)"));
    assert.ok(source.includes("scroll-mt-24"));
    assert.ok(source.includes("source_references"));
  }
});

test("SCHOOL-UX5 English and localized guides retain source evidence", () => {
  for (const [source, key] of [[englishStandard, "en-standard"], [englishGrade, "en-grade"]]) {
    assert.ok(source.includes('<SchoolReadingIndex locale="en"'));
    for (let i=1; i<=3; i++) assert.ok(source.includes(key + "-part-" + i));
    assert.ok(source.includes("published.last_reviewed_at"));
    assert.ok(source.includes("sourceLinks.map"));
  }
  assert.ok(intl.includes("<SchoolReadingIndex locale={locale}"));
  for (let i=1; i<=3; i++) assert.ok(intl.includes("localized-reading-part-" + i));
  assert.ok(intl.includes("SchoolEditorialTrust"));
  assert.ok(intl.includes("SchoolTechnicalGlossary"));
  assert.ok(intl.includes("uniqueSources.map"));
});

test("SCHOOL-UX5 browser QA distinguishes absent K2 publication data from live reading guides", () => {
  const browser = read("./school-ux5-chrome-reading.mjs");
  assert.match(browser, /hasPublishedDataset/);
  assert.match(browser, /publishedRecordRequired: true/);
  assert.match(browser, /publishedRecordRequired: false/);
  assert.match(browser, /assert\.equal\(response\?\.status\(\), 404/);
  assert.match(browser, /assert\.equal\(response\?\.status\(\), 200/);
  assert.ok(browser.includes("await nav.locator(") && browser.includes(".first().click()"));
});
