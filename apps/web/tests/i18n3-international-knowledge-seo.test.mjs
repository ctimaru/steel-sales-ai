import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const editorialCode = read("../lib/international-steel-knowledge.ts");
const js = ts.transpileModule(editorialCode, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const editorial = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const enStandards = read("../app/en/knowledge/standards/page.tsx");
const enGrades = read("../app/en/knowledge/grades/page.tsx");
const enStandard = read("../app/en/knowledge/standards/[slug]/page.tsx");
const enGrade = read("../app/en/knowledge/grades/[slug]/page.tsx");
const itStandards = read("../app/(public)/knowledge/norme/page.tsx");
const itGrades = read("../app/(public)/knowledge/gradi/page.tsx");
const itStandard = read("../app/(public)/knowledge/norme/[slug]/page.tsx");
const itGrade = read("../app/(public)/knowledge/gradi/[slug]/page.tsx");
const enHub = read("../app/en/knowledge/page.tsx");
const sitemap = read("../app/sitemap.ts");
const sharedNav = read("../components/english-public-subpage.tsx");
const k3Seed = read("../../../supabase/migrations/20260928121000_k3_public_standards_catalog.sql");
const k4Seed = read("../../../supabase/migrations/20260928124500_k4_public_grades_catalog.sql");

test("I18N3 English editorial guides are explicitly curated with valid unique source slugs", () => {
  assert.equal(editorial.englishStandards.length, 6);
  assert.equal(editorial.englishGrades.length, 10);
  const standardSlugs = editorial.englishStandards.map(({slug}) => slug);
  const gradeSlugs = editorial.englishGrades.map(({slug}) => slug);
  assert.equal(new Set(standardSlugs).size, standardSlugs.length);
  assert.equal(new Set(gradeSlugs).size, gradeSlugs.length);
  for (const item of editorial.englishStandards) {
    assert.ok(item.summary.length > 90 && item.procurement.length > 90);
    assert.ok(k3Seed.includes(`'${item.slug}'`), `Standard not backed by K3 seed: ${item.slug}`);
    for (const grade of item.relatedGrades) assert.ok(gradeSlugs.includes(grade));
  }
  for (const item of editorial.englishGrades) {
    assert.ok(item.summary.length > 90 && item.procurement.length > 65);
    assert.ok(k4Seed.toLowerCase().includes(`'${item.slug}'`), `Grade not backed by K4 seed: ${item.slug}`);
    for (const standard of item.relatedStandards) assert.ok(standardSlugs.includes(standard));
  }
  assert.equal(editorial.englishStandardForSlug("unapproved-standard"), null);
  assert.equal(editorial.englishGradeForSlug("unapproved-grade"), null);
});

test("I18N3 only publishes English index/detail content backed by anonymous-safe public Knowledge", () => {
  assert.match(enStandards, /await listPublicStandards\(\)/);
  assert.match(enGrades, /await listPublicGrades\(\)/);
  assert.match(enStandards, /publishedBySlug\.has\(item.slug\)/);
  assert.match(enGrades, /publishedBySlug\.has\(item.slug\)/);
  assert.match(enStandard, /await readPublishedStandard\(slug\)/);
  assert.match(enGrade, /await readPublishedGrade\(slug\)/);
  assert.match(enStandard, /if \(!published\) notFound\(\)/);
  assert.match(enGrade, /if \(!published\) notFound\(\)/);
  assert.match(enStandard, /listPublicGrades\(\)/);
  assert.match(enGrade, /listPublicStandards\(\)/);
  assert.doesNotMatch(enStandard + enGrade + enStandards + enGrades, /service_role|from\("steel_|createClient\(|getUser\(/);
});

test("I18N3 applies self-canonicals, reciprocal locale alternates and noindex to search pages", () => {
  assert.match(enStandards, /canonical: absoluteUrl\(canonical\)/);
  assert.match(enGrades, /canonical: absoluteUrl\(canonical\)/);
  assert.match(enStandard, /canonical: absoluteUrl\(path\)/);
  assert.match(enGrade, /canonical: absoluteUrl\(path\)/);
  assert.match(enStandards, /robotsForParameterizedPage\(Boolean\(q\?\.trim\(\)\)\)/);
  assert.match(enGrades, /robotsForParameterizedPage\(Boolean\(q\?\.trim\(\)\)\)/);
  assert.match(itStandards, /en: absoluteUrl\("\/en\/knowledge\/standards"\)/);
  assert.match(itGrades, /en: absoluteUrl\("\/en\/knowledge\/grades"\)/);
  assert.match(itStandard, /englishStandardForSlug\(standard.slug\)/);
  assert.match(itGrade, /englishGradeForSlug\(grade.slug\)/);
  assert.match(enStandard, /it: absoluteUrl\(`\/knowledge\/norme\/\$\{copy.slug\}`\)/);
  assert.match(enGrade, /it: absoluteUrl\(`\/knowledge\/gradi\/\$\{copy.slug\}`\)/);
});

test("I18N3 sitemap derives published English URLs from live source records only", () => {
  assert.match(sitemap, /\.filter\(\(standard\) => Boolean\(englishStandardForSlug\(standard.slug\)\)\)/);
  assert.match(sitemap, /\.filter\(\(grade\) => Boolean\(englishGradeForSlug\(grade.slug\)\)\)/);
  assert.match(sitemap, /\.\.\.englishStandardEntries/);
  assert.match(sitemap, /\.\.\.englishGradeEntries/);
  assert.match(sitemap, /"\/en\/knowledge\/standards"/);
  assert.match(sitemap, /"\/en\/knowledge\/grades"/);
});

test("I18N3 connects English knowledge navigation, editorial sources and disclaimers", () => {
  assert.ok(enHub.includes('href: "/en/knowledge/standards"'));
  assert.ok(enHub.includes('href: "/en/knowledge/grades"'));
  assert.match(sharedNav, /English mobile public navigation/);
  assert.match(enStandard + enGrade, /TechArticle/);
  assert.match(enStandard + enGrade, /BreadcrumbList/);
  assert.match(enStandard + enGrade, /source_references/);
  assert.match(enStandard + enGrade, /rel="noopener noreferrer"/);
  assert.match(enStandard + enGrade, /certification|conformity|compliance/i);
  assert.doesNotMatch(editorialCode, /automatic equivalence permitted/i);
});
