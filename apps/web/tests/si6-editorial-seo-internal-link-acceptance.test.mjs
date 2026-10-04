import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const articleData = fs.readFileSync(
  new URL("../lib/school-articles.ts", import.meta.url),
  "utf8",
);
const articlePage = fs.readFileSync(
  new URL("../app/(public)/knowledge/articoli/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const articleIndex = fs.readFileSync(
  new URL("../app/(public)/knowledge/articoli/page.tsx", import.meta.url),
  "utf8",
);
const standards = fs.readFileSync(
  new URL("../app/(public)/knowledge/norme/page.tsx", import.meta.url),
  "utf8",
);
const grades = fs.readFileSync(
  new URL("../app/(public)/knowledge/gradi/page.tsx", import.meta.url),
  "utf8",
);
const layout = fs.readFileSync(
  new URL("../app/(public)/knowledge/layout.tsx", import.meta.url),
  "utf8",
);

test("SI6 gives every editorial article an explicit related-article graph", () => {
  assert.match(articleData, /relatedArticleSlugs: string\[\]/);
  assert.match(articleData, /slug: "storia-tubi-acciaio"[\s\S]*relatedArticleSlugs:/);
  assert.match(articleData, /slug: "produttori-tubi-europa"[\s\S]*relatedArticleSlugs:/);
  assert.match(articleData, /slug: "come-si-producono-tubi-acciaio"[\s\S]*relatedArticleSlugs:/);
  assert.match(articlePage, /Approfondimenti collegati/);
  assert.match(articlePage, /relatedArticleSlugs/);
  assert.match(articlePage, /Leggi approfondimento/);
});

test("SI6 connects articles to standards calculator and public company discovery", () => {
  assert.match(articleData, /href: "\/knowledge\/norme"/);
  assert.match(articleData, /#calcolatore-pesi/);
  assert.match(articleData, /href: "\/azienda"/);
  assert.match(articlePage, /Calcola pesi/);
  assert.match(articlePage, /Trova azienda/);
  assert.match(articleIndex, /Calcolatore pesi/);
  assert.match(articleIndex, /Trova azienda/);
  assert.match(layout, /<SchoolClaimCta \/>/);
});

test("SI6 creates return links from technical catalogues to editorial context", () => {
  assert.match(standards, /Approfondimento editoriale/);
  assert.match(standards, /come-si-producono-tubi-acciaio/);
  assert.match(grades, /Approfondimento editoriale/);
  assert.match(grades, /come-si-producono-tubi-acciaio/);
  assert.match(standards, /source=school&surface=school_section#calcolatore-pesi/);
  assert.match(grades, /source=school&surface=school_section#calcolatore-pesi/);
});

test("SI6 hardens Article structured data for topical SEO", () => {
  assert.match(articleData, /keywords: string\[\]/);
  assert.match(articleData, /about: string\[\]/);
  assert.match(articlePage, /inLanguage: "it-IT"/);
  assert.match(articlePage, /keywords: article\.keywords/);
  assert.match(articlePage, /about: article\.about\.map/);
  assert.match(articlePage, /isPartOf:/);
  assert.match(articlePage, /CollectionPage/);
});

test("SI6 keeps canonical article URLs and source citations intact", () => {
  assert.match(articlePage, /canonical: absoluteUrl\(\`\/knowledge\/articoli\/\$\{article\.slug\}\`\)/);
  assert.match(articlePage, /citation: article\.sources\.map/);
  assert.match(articlePage, /BreadcrumbList/);
});
