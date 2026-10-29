import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const hero = read("../components/school-workspace-first-viewport.tsx");
const itHome = read("../app/(italian)/(workspace)/school/page.tsx");
const intlHome = read("../components/school-localized-workspace-home.tsx");
const topbar = read("../components/school-private-language-switch.tsx");
const standard = read("../app/(italian)/(workspace)/school/norme/page.tsx");
const grade = read("../app/(italian)/(workspace)/school/gradi/page.tsx");
const reference = read("../components/school-private-reference-index.tsx");
const commercialMemory = read("../app/(italian)/(workspace)/commercial/knowledge/page.tsx");
const publicStandards = read("../app/(italian)/(public)/knowledge/norme/page.tsx");
const publicGrades = read("../app/(italian)/(public)/knowledge/gradi/page.tsx");

test("SCHOOL-UX6 keeps a compact photographic identity with a single featured published-evidence tutor entry", () => {
  assert.match(hero, /min-h-\[204px\]/);
  assert.match(hero, /data-testid="school-ux6-professor-entry"/);
  assert.equal((hero.match(/schoolWorkspaceHref\("\/school\/professore",locale\)/g)||[]).length, 1);
  assert.match(hero, /href="#school-private-search"/);
  assert.match(hero, /const professor: Record<SchoolWorkspaceLocale, string>/);
  assert.match(hero, /en: "Ask the professor \(Italian\)"/);
  assert.match(hero, /home-cine1a-steel\.webp/);
  assert.doesNotMatch(hero, /<SchoolGuidedAssistant|sendRf[qQ]|KnowledgeExplorer|supabaseAdmin/);
});

test("SCHOOL-UX6 gives technical lookup priority over a single compact calculator handoff", () => {
  assert.ok(hero.indexOf('id="school-private-search"') < hero.indexOf('id="school-private-calculator-heading"'));
  assert.match(hero, /action=\{"\/school\/"\+group\}/);
  assert.match(hero, /name="lang" value=\{locale\}/);
  assert.match(hero, /CALCULATOR_ROUTES\[locale\]/);
  assert.match(hero, /\/school\/tubes\?source=school&surface=home_card/);
  assert.match(hero, /kg\/m/);
  assert.doesNotMatch(hero, /lg:grid-cols-\[minmax\(0,1\.12fr\)/);
});

test("SCHOOL-UX6 private homes remove the duplicate commercial journey and progressively disclose secondary resources", () => {
  for (const page of [itHome, intlHome]) {
    assert.doesNotMatch(page, /<SchoolJourney|<SchoolConversionPath|school-private-tool-card/);
    assert.match(page, /data-testid="school-ux6-personal-resources"/);
    assert.match(page, /SchoolWorkspaceFirstViewport/);
    assert.match(page, /<SchoolQuickAccess/);
    assert.match(page, /<SchoolTechnicalSections/);
    assert.doesNotMatch(page, /\/school\/explorer|KnowledgeExplorer|private-documents/);
  }
  assert.match(topbar, /compact\?"sr-only"/);
});

test("SCHOOL-UX6 authenticated catalogs are compact and still read only published School K2 data", () => {
  assert.match(standard, /<SchoolPrivateReferenceIndex locale=\{locale\} kind="norme"/);
  assert.match(grade, /<SchoolPrivateReferenceIndex locale=\{locale\} kind="gradi"/);
  assert.doesNotMatch(standard+grade, /StandardsIndexPage|GradesIndexPage/);
  assert.match(reference, /listPublicStandards\(\)/);
  assert.match(reference, /listPublicGrades\(\)/);
  assert.match(reference, /min-h-\[148px\]/);
  assert.match(reference, /locale!=="it"/);
  assert.doesNotMatch(reference, /getWorkspaceContext|searchKnowledge|service_role|supabaseAdmin/);
  assert.match(commercialMemory, /<KnowledgeExplorer locale="it"/);
  // Public SEO page contracts (canonical, indexability and JSON-LD) remain unchanged by this branch.
  assert.match(publicStandards, /canonical: absoluteUrl\("\/knowledge\/norme"\)/);
  assert.match(publicGrades, /canonical: absoluteUrl\("\/knowledge\/gradi"\)/);
});
