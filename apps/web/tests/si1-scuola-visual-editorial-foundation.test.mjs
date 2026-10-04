import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(new URL("../app/(public)/knowledge/layout.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");
const standards = fs.readFileSync(new URL("../app/(public)/knowledge/norme/page.tsx", import.meta.url), "utf8");
const grades = fs.readFileSync(new URL("../app/(public)/knowledge/gradi/page.tsx", import.meta.url), "utf8");
const tubes = fs.readFileSync(new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url), "utf8");
const articlesIndex = fs.readFileSync(new URL("../app/(public)/knowledge/articoli/page.tsx", import.meta.url), "utf8");
const articleDetail = fs.readFileSync(new URL("../app/(public)/knowledge/articoli/[slug]/page.tsx", import.meta.url), "utf8");
const articleData = fs.readFileSync(new URL("../lib/school-articles.ts", import.meta.url), "utf8");
const schoolUi = fs.readFileSync(new URL("../components/school-ui.tsx", import.meta.url), "utf8");
const calculator = fs.readFileSync(new URL("../components/public-tube-weight-calculator.tsx", import.meta.url), "utf8");
const claimCta = fs.readFileSync(new URL("../components/school-claim-cta.tsx", import.meta.url), "utf8");
const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

test("SI1 gives every top-level Scuola section the same hero grammar", () => {
  for (const source of [home, standards, grades, tubes, articlesIndex]) {
    assert.match(source, /SchoolHero/);
  }
  assert.match(schoolUi, /school-hero/);
  assert.match(schoolUi, /school-eyebrow/);
  assert.match(globals, /\.school-hero/);
  assert.match(globals, /\.school-hero-accent/);
});

test("SI1 centralizes high-contrast primary and secondary Scuola actions", () => {
  assert.match(globals, /\.school-primary-action/);
  assert.match(globals, /background: var\(--brand-900\)/);
  assert.match(globals, /color: #ffffff !important/);
  assert.match(globals, /\.school-secondary-action/);
  assert.match(globals, /color: var\(--brand-900\) !important/);
  assert.match(layout, /school-primary-action/);
  assert.match(layout, /school-secondary-action/);
  assert.match(standards, /school-primary-action h-11/);
  assert.match(grades, /school-primary-action h-11/);
  assert.match(calculator, /school-selected-control rounded-xl px-3 py-2\.5/);
  assert.match(calculator, /school-secondary-action px-3 py-2\.5/);
  assert.match(claimCta, /border-white\/60/);
});

test("SI2 exposes an editorial hub from desktop and mobile Scuola navigation", () => {
  assert.match(layout, /href="\/knowledge\/articoli"/);
  assert.match(layout, /\["\/knowledge\/articoli", "Articoli"\]/);
  assert.match(home, /href: "\/knowledge\/articoli"/);
  assert.match(home, /schoolArticles\.slice\(0, 3\)/);
  assert.match(articlesIndex, /Biblioteca editoriale/);
});

test("SI2 publishes sourced history and European producer articles", () => {
  assert.match(articleData, /slug: "storia-tubi-acciaio"/);
  assert.match(articleData, /1885–1886/);
  assert.match(articleData, /Remscheid/);
  assert.match(articleData, /Albert Poensgen/);
  assert.match(articleData, /slug: "produttori-tubi-europa"/);
  for (const producer of ["ArcelorMittal", "Tenaris", "Mannesmann", "voestalpine", "Marcegaglia"]) {
    assert.match(articleData, new RegExp(producer, "i"));
  }
  assert.match(articleData, /fonti pubbliche aggiornate/);
  assert.match(articleDetail, /Fonti consultate/);
  assert.match(articleDetail, /dateModified/);
});

test("SI2 keeps article SEO canonical and in the public sitemap", () => {
  assert.match(articlesIndex, /canonical: absoluteUrl\("\/knowledge\/articoli"\)/);
  assert.match(articleDetail, /canonical: absoluteUrl\(\`\/knowledge\/articoli\/\$\{article\.slug\}\`\)/);
  assert.match(articleDetail, /"@type": "Article"/);
  assert.match(articleDetail, /"@type": "BreadcrumbList"/);
  assert.match(sitemap, /schoolArticles/);
  assert.match(sitemap, /\/knowledge\/articoli\/\$\{article\.slug\}/);
});

test("SI2 articles stay editorial and do not expose the private Network", () => {
  assert.doesNotMatch(articlesIndex + articleDetail, /href="\/network/);
  assert.match(articleData, /Network Smart Steel Sales rimane invece il prodotto privato/);
});
