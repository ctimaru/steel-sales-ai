import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// CALC-INT4.3 — deterministic link graph/SEO invariants, no live Google calls.
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const compiled = input => ts.transpileModule(input, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
async function load(path) {
  return import("data:text/javascript;base64,"+Buffer.from(compiled(read(path))).toString("base64"));
}
const landing = read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx");
const article = read("../app/(international-calculator)/[locale]/knowledge/tubes/[topic]/page.tsx");
const sitemap = read("../app/sitemap.ts");
const locator = await load("../lib/international-calculator-landing.ts");
const pillar = await load("../lib/calculator-market-editorial.ts");
const satellite = await load("../lib/calculator-topic-clusters.ts");
const selector = read("../components/calculator-page-language-selector.tsx");
const regions = read("../components/calculator-region-switch.tsx");

test("CALC-INT4.3: 5 known calculator routes stay unique and unchanged",()=>{
  assert.deepEqual(locator.CALCULATOR_ROUTES,{
    it:"/knowledge/tubes",
    en:"/en/knowledge/tubes",
    de:"/de/knowledge/tubes",
    fr:"/fr/knowledge/tubes",
    es:"/es/knowledge/tubes",
  });
  assert.equal(new Set(Object.values(locator.CALCULATOR_ROUTES)).size,5);
  assert.match(landing,/canonical:absoluteUrl\(path\)/);
  assert.match(landing,/localizedHrefLangPaths\(\)/);
  assert.match(landing,/robotsForParameterizedPage\(hasParameters\)/);
  assert.match(selector,/hrefLang=\{code\} lang=\{code\}/);
  assert.match(regions,/PublicTubeWeightCalculator/);
});

test("CALC-INT4.3: three calculator landings link directly to BOTH local guides",()=>{
  for(const loc of ["de","fr","es"]){
    assert.ok(pillar.MARKET_GUIDE_ROUTES[loc]?.startsWith("/"+loc+"/knowledge/tubes/"));
    assert.ok(satellite.MARKET_TOPIC_ROUTES[loc]?.startsWith("/"+loc+"/knowledge/tubes/"));
    assert.notEqual(pillar.MARKET_GUIDE_ROUTES[loc],satellite.MARKET_TOPIC_ROUTES[loc]);
    assert.equal(typeof satellite.MARKET_TOPIC_GUIDES[loc].title,"string");
    assert.ok(satellite.MARKET_TOPIC_GUIDES[loc].description.length > 90);
  }
  assert.match(landing,/import \{ MARKET_TOPIC_GUIDES, MARKET_TOPIC_ROUTES \}/);
  assert.match(landing,/const topic=MARKET_TOPIC_GUIDES\[locale\]/);
  assert.match(landing,/href=\{MARKET_GUIDE_ROUTES\[locale\]\}/);
  assert.match(landing,/href=\{MARKET_TOPIC_ROUTES\[locale\]\}/);
  assert.match(landing,/\{topic.title\}/);
  assert.match(landing,/\{topic.description\}/);
  assert.match(landing,/border-t border-\[#e1eae4\]/);
  assert.match(landing,/min-h-11/);
});

test("CALC-INT4.3: breadcrumbs visible and JSON-LD have same 3/4 levels",()=>{
  assert.match(article,/"@type": "BreadcrumbList"/);
  assert.match(article,/position: isPillar \? 3 : 4/);
  assert.match(article,/\.\.\.\(!isPillar \? \[\{ "@type": "ListItem"/);
  assert.match(article,/href=\{PUBLIC_HOME_LOCALE_ROUTES\[locale\]\}/);
  assert.match(article,/href=\{calculatorPath\}/);
  assert.match(article,/!isPillar \? <>/);
  assert.match(article,/href=\{MARKET_GUIDE_ROUTES\[locale\]\}/);
  assert.match(article,/aria-current="page"/);
  assert.match(article,/\{MARKET_GUIDES\[locale\]\.title\}/);
  assert.match(article,/\{guide.title\}/);
  assert.match(article,/break-words/);
});

test("CALC-INT4.3: SEO: pillar translations reciprocal, market-specific satellites self-canonical only",()=>{
  assert.match(article,/dynamicParams = false/);
  assert.match(article,/topic !== guide.slug/);
  assert.match(article,/isPillar\s*\?\s*\{ canonical: absoluteUrl\(path\), languages: languageAlternates \}/);
  assert.match(article,/: \{ canonical: absoluteUrl\(path\) \}/);
  assert.match(article,/robotsForParameterizedPage\(Object.values\(query\).some\(Boolean\)\)/);
  assert.match(article,/"@type": "TechArticle"/);
  assert.match(article,/"@type": "FAQPage"/);
  assert.match(sitemap,/MARKET_GUIDE_ROUTES\[locale\]/);
  assert.match(sitemap,/MARKET_TOPIC_ROUTES\[locale\]/);
  assert.equal(Object.values(pillar.MARKET_GUIDE_ROUTES).length,3);
  assert.equal(Object.values(satellite.MARKET_TOPIC_ROUTES).length,3);
  assert.equal(new Set([...Object.values(pillar.MARKET_GUIDE_ROUTES),...Object.values(satellite.MARKET_TOPIC_ROUTES)]).size,6);
});

test("CALC-INT4.3: SEO link graph preserves free tool → bill without supplier dispatch",()=>{
  assert.match(landing,/CalculatorRegionSwitch locale=\{locale\}/);
  assert.match(article,/const calculatorPath = CALCULATOR_ROUTES\[locale\]/);
  assert.match(article,/const billPath = \`\/\$\{locale\}\/distinta\`/);
  assert.match(article,/href=\{billPath\}/);
  assert.match(article,/const relatedPath = isPillar \? MARKET_TOPIC_ROUTES\[locale\] : MARKET_GUIDE_ROUTES\[locale\]/);
  assert.doesNotMatch(landing,/enqueueCalculatorRfq|supabase\.from|dispatchSupplier/);
  assert.doesNotMatch(article,/enqueueCalculatorRfq|supabase\.from|dispatchSupplier/);
});

test("CALC-INT4.3: no synthetic GSC metrics or invented claims introduced",()=>{
  for(const src of [landing,article]) {
    assert.doesNotMatch(src,/monthlySearchVolume|fabricatedVolume|rankingGuarantee/);
    assert.doesNotMatch(src,/hreflang=.*MARKET_TOPIC_ROUTES/);
  }
});
