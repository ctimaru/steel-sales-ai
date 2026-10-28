import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const englishShell = read("../components/english-public-subpage.tsx");
const englishStandards = read("../app/(english)/en/knowledge/standards/page.tsx");
const englishGrades = read("../app/(english)/en/knowledge/grades/page.tsx");
const englishStandard = read("../app/(english)/en/knowledge/standards/[slug]/page.tsx");
const englishGrade = read("../app/(english)/en/knowledge/grades/[slug]/page.tsx");
const localizedLayout = read("../components/localized-knowledge-layout.tsx");
const localizedIndex = read("../app/(international-calculator)/[locale]/knowledge/[kind]/page.tsx");
const localizedDetail = read("../app/(international-calculator)/[locale]/knowledge/[kind]/[slug]/page.tsx");
const navigation = read("../components/school-unified-navigation.tsx");

test("SCHOOL-UX4 keeps photographic visuals opt-in only for English knowledge", () => {
  assert.match(englishShell, /schoolKnowledgeEditorial\?: boolean/);
  assert.match(englishShell, /home-cine1a-steel\.webp/);
  assert.match(englishShell, /bg-\[#102921\]/);
  for (const source of [englishStandards, englishGrades, englishStandard, englishGrade]) {
    assert.match(source, /schoolKnowledgeEditorial/);
    assert.match(source, /EnglishPublicSubpage/);
    assert.match(source, /absoluteUrl/);
  }
});

test("SCHOOL-UX4 retains published-only search and canonicals across five languages", () => {
  for (const source of [englishStandards, englishGrades]) {
    assert.match(source, /robotsForParameterizedPage/);
    assert.match(source, /publishedBySlug\.has/);
    assert.match(source, /method="get"/);
    assert.match(source, /school-catalog-search/);
  }
  assert.match(localizedIndex, /robotsForParameterizedPage/);
  assert.match(localizedIndex, /MARKET_TECHNICAL_RECORDS\[locale\]\[scope\]/);
  assert.match(localizedIndex, /published\.has\(x\.slug\)/);
  assert.match(localizedIndex, /id="school-localized-search"/);
  assert.match(localizedIndex, /<SchoolHero/);
  assert.match(localizedIndex, /\s+editorial/);
  assert.match(localizedLayout, /activeHref=\{localizedKnowledgePath\(locale,kind\)\}/);
  assert.match(navigation, /aria-current=\{\(activeHref/);
  assert.match(navigation, /const compactEntries = activeHref/);
  assert.match(navigation, /compactEntries\.map/);
});

test("SCHOOL-UX4 respects editorial source, reading and compliance boundaries", () => {
  for (const source of [englishStandard, englishGrade]) {
    assert.match(source, /published\.last_reviewed_at/);
    assert.match(source, /sourceLinks\.map/);
    assert.match(source, /leading-8/);
    assert.match(source, /schoolKnowledgeEditorial/);
  }
  assert.match(localizedDetail, /<SchoolHero/);
  assert.match(localizedDetail, /\s+reading/);
  assert.match(localizedDetail, /SchoolEditorialTrust/);
  assert.match(localizedDetail, /SchoolTechnicalGlossary/);
  assert.match(localizedDetail, /uniqueSources\.map/);
  assert.match(localizedDetail, /"@type":"TechArticle"/);
});

test("SCHOOL-UX4 keeps consent choices but uses compact copy throughout public knowledge locales", () => {
  const consent = read("../components/google-analytics-consent.tsx");
  assert.match(consent, /const compactSchoolConsent/);
  assert.ok(consent.includes("(?:en|de|fr|es)"));
  assert.match(consent, /localizedConsent\?\.short/);
  assert.match(consent, /const showPanel = consent === null \|\| settingsOpen/);
});
