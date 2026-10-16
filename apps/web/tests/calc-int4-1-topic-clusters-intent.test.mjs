import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const transpile = s => ts.transpileModule(s, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const manifest = await import("data:text/javascript;base64," + Buffer.from(
  transpile(read("../lib/calculator-topic-clusters.ts"))
).toString("base64"));
const core = await import("data:text/javascript;base64," + Buffer.from(
  transpile(read("../lib/international-calculator-landing.ts"))
).toString("base64"));

const articlePage = read("../app/(international-calculator)/[locale]/knowledge/tubes/[topic]/page.tsx");
const sitemap = read("../app/sitemap.ts");
const calcLanding = read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx");
const region = read("../components/calculator-region-switch.tsx");

test("CALC-INT4.1: three content-rich, distinctive country-specific topic pages with first-party sources", () => {
  const locales = ["de","fr","es"];
  assert.deepEqual(Object.keys(manifest.MARKET_TOPIC_GUIDES), locales);
  assert.deepEqual(Object.keys(manifest.MARKET_TOPIC_ROUTES), locales);
  const allTitles = new Set();
  const allSlugs = new Set();
  const allQueries = new Set();
  for (const locale of locales) {
    const guide = manifest.MARKET_TOPIC_GUIDES[locale];
    const intent = manifest.MARKET_TOPIC_INTENT[locale];
    assert.equal(manifest.MARKET_TOPIC_ROUTES[locale], `/${locale}/knowledge/tubes/${guide.slug}`);
    assert.equal(intent.evidence, "editorial-hypothesis");
    assert.equal(intent.intent, "informational-to-procurement");
    assert.ok(intent.primaryQuery.length > 12);
    assert.equal(intent.secondaryQueries.length, 3);
    assert.ok(intent.measurement.length > 35);
    assert.ok(guide.title.length > 30 && guide.description.length >= 110 && guide.description.length <= 180);
    assert.equal(guide.sections.length, 4);
    assert.ok(guide.sections.every(s => s.heading.length > 18 &&
      s.paragraphs.length === 2 && s.paragraphs.every(p => p.length > 170)));
    assert.ok(guide.intro.length > 180 && guide.example.length > 180);
    assert.ok(guide.questions.length >= 2 && guide.checklist.length === 4);
    assert.ok(guide.sources.length >= 2 && guide.sources.every(s => s.url.startsWith("https://")));
    assert.ok(guide.warning.length > 160);
    assert.ok(!guide.title.includes("Smart Steel Sales"));
    assert.equal(core.CALCULATOR_ROUTES[locale], `/${locale}/knowledge/tubes`);
    allTitles.add(guide.title);allSlugs.add(guide.slug);allQueries.add(intent.primaryQuery);
  }
  assert.equal(allTitles.size, 3);
  assert.equal(allSlugs.size, 3);
  assert.equal(allQueries.size, 3);
  assert.match(manifest.MARKET_TOPIC_GUIDES.de.intro, /Stahlbau/);
  assert.match(manifest.MARKET_TOPIC_GUIDES.fr.intro, /certificat matière/);
  assert.match(manifest.MARKET_TOPIC_GUIDES.es.intro, /UNE/);
});

test("CALC-INT4.1: new topics are statically routed with self canonicals, no unrelated hreflang", () => {
  assert.match(articlePage, /dynamicParams = false/);
  assert.match(articlePage, /\.flatMap\(locale/);
  assert.match(articlePage, /MARKET_TOPIC_GUIDES\[locale\]\.slug/);
  assert.match(articlePage, /topic !== guide\.slug/);
  assert.match(articlePage, /notFound\(\)/);
  assert.match(articlePage, /MARKET_TOPIC_ROUTES\[locale\]/);
  assert.match(articlePage, /isPillar\s*\?\s*\{ canonical: absoluteUrl\(path\), languages: languageAlternates \}/);
  assert.match(articlePage, /: \{ canonical: absoluteUrl\(path\) \}/);
  assert.match(articlePage, /robotsForParameterizedPage\(Object\.values\(query\)\.some\(Boolean\)\)/);
  assert.match(articlePage, /"@type": "TechArticle"/);
  assert.match(articlePage, /"@type": "BreadcrumbList"/);
  assert.match(articlePage, /"@type": "FAQPage"/);
  assert.match(articlePage, /citation: guide\.sources\.map/);
  assert.match(articlePage, /href=\{relatedPath\}/);
  assert.match(articlePage, /href=\{calculatorPath\}/);
  assert.match(articlePage, /href=\{billPath\}/);
  assert.match(sitemap, /MARKET_TOPIC_ROUTES\[locale\]/);
  assert.match(sitemap, /MARKET_GUIDE_ROUTES\[locale\]/);
  // CALC-INT4.3: a compact direct satellite link is now intentional. Do not
  // duplicate long editorial content below the calculator.
  assert.match(calcLanding, /const topic=MARKET_TOPIC_GUIDES\[locale\]/);
  assert.match(calcLanding, /href=\{MARKET_TOPIC_ROUTES\[locale\]\}/);
  assert.doesNotMatch(calcLanding, /topic\.sections\.map|topic\.questions\.map|topic\.checklist\.map/);
  assert.match(region, /PublicTubeWeightCalculator/);
});

test("CALC-INT4.1: no fabricated keyword metrics, protected norms or unapproved commercial actions", () => {
  const all = Object.values(manifest.MARKET_TOPIC_GUIDES).map(v=>JSON.stringify(v)).join(" ");
  assert.doesNotMatch(all, /Suchvolumen|recherches\/mois|búsquedas mensuales|garantierte Rankings/);
  assert.doesNotMatch(all, /\b\d+(?:[,.]\d+)?\s*%\s*(?:Grenzabmaß|toleranz|tolérance|tolerancia)/i);
  assert.doesNotMatch(articlePage, /sendSupplierEmail|dispatchRfq|supabase\.from/);
  assert.doesNotMatch(read("../lib/calculator-topic-clusters.ts"), /import\s+.+from\s+["']@\/lib\/international-tube-mass/);
});
