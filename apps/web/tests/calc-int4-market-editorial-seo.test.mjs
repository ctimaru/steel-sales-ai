import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const transpile = s => ts.transpileModule(s, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const editorial = await import("data:text/javascript;base64," + Buffer.from(
  transpile(read("../lib/calculator-market-editorial.ts"))
).toString("base64"));

const guidePage = read("../app/(international-calculator)/[locale]/knowledge/tubes/[topic]/page.tsx");
const calculatorPage = read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx");
const sitemap = read("../app/sitemap.ts");
const layout = read("../app/(international-calculator)/[locale]/layout.tsx");
const calculator = read("../components/calculator-region-switch.tsx");

test("CALC-INT4: three unique indexable market guides with source-backed original text", () => {
  const loc = ["de","fr","es"];
  assert.deepEqual(Object.keys(editorial.MARKET_GUIDES), loc);
  assert.deepEqual(Object.keys(editorial.MARKET_GUIDE_ROUTES), loc);
  const titles = new Set();
  for (const locale of loc) {
    const guide = editorial.MARKET_GUIDES[locale];
    const url = editorial.MARKET_GUIDE_ROUTES[locale];
    assert.equal(url, "/" + locale + "/knowledge/tubes/" + guide.slug);
    assert.equal(guide.sections.length, 4);
    assert.ok(guide.sections.every(s => s.paragraphs.length >= 2 &&
      s.paragraphs.every(p => p.length > 160)), locale + " insufficient original editorial depth");
    assert.ok(guide.questions.length >= 2 && guide.checklist.length >= 4);
    assert.ok(guide.description.length >= 100 && guide.description.length <= 180);
    assert.ok(guide.sources.length >= 2 && guide.sources.every(s => s.url.startsWith("https://")));
    titles.add(guide.title);
    assert.ok(guide.warning.length > 120);
  }
  assert.equal(titles.size, 3, "Editorials must not be machine-translated duplicates");
  assert.match(editorial.MARKET_GUIDES.de.intro, /Deutschland|DIN EN/);
  assert.match(editorial.MARKET_GUIDES.fr.intro, /construction métallique|NF EN/);
  assert.match(editorial.MARKET_GUIDES.es.intro, /UNE-EN/);
  assert.match(editorial.MARKET_GUIDES.de.sections[3].paragraphs.join(" "), /Entwurf/);
  assert.match(editorial.MARKET_GUIDES.fr.sections[3].paragraphs.join(" "), /projets|enquête publique/);
  assert.match(editorial.MARKET_GUIDES.es.sections[0].paragraphs.join(" "), /UNE-EN 10219-2:2019/);
});

test("CALC-INT4: scoped topic routes, national hreflang and TechArticle evidence", () => {
  assert.match(guidePage, /dynamicParams = false/);
  assert.match(guidePage, /generateStaticParams/);
  assert.match(guidePage, /topic !== guide.slug/);
  assert.match(guidePage, /notFound\(\)/);
  assert.match(guidePage, /robotsForParameterizedPage/);
  assert.match(guidePage, /canonical: absoluteUrl\(path\)/);
  assert.match(guidePage, /languages: languageAlternates/);
  assert.match(guidePage, /"@type": "TechArticle"/);
  assert.match(guidePage, /"@type": "BreadcrumbList"/);
  assert.match(guidePage, /"@type": "FAQPage"/);
  assert.match(guidePage, /citation: guide.sources.map/);
  assert.match(guidePage, /guide.questions.map/);
  assert.match(guidePage, /href=\{calculatorPath\}/);
  assert.match(guidePage, /href=\{billPath\}/);
  assert.match(layout, /SiteDocument lang=\{locale\}/);
  assert.match(sitemap, /MARKET_GUIDE_ROUTES\[locale\]/);
  for (const l of ["de", "fr", "es"]) {
    assert.ok(editorial.MARKET_GUIDE_ROUTES[l].startsWith("/"+l+"/"));
    assert.match(sitemap, new RegExp("MARKET_GUIDE_ROUTES\\."+l));
  }
});

test("CALC-INT4: internal link from live calculator without changing engine or RFQ dispatch", () => {
  assert.match(calculatorPage, /MARKET_GUIDE_ROUTES\[locale\]/);
  assert.match(calculatorPage, /guide\.title/);
  assert.match(calculatorPage, /CalculatorRegionSwitch locale=\{locale\}/);
  assert.match(calculatorPage, /copy\.faq\.map/);
  assert.doesNotMatch(guidePage, /supabase|sendSupplierEmail|dispatchRfq|schoolArticles/);
  assert.match(calculator, /CalculatorInlineDistintaExperience/);
});
