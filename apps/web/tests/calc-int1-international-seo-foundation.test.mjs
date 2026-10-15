import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const contract = read("../lib/calculator-international-contract.ts");
const compiled = ts.transpileModule(contract, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const routes = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const italian = read("../app/(public)/knowledge/tubes/page.tsx");
const english = read("../app/en/knowledge/tubes/page.tsx");
const sitemap = read("../app/sitemap.ts");
const itLayout = read("../app/(italian)/layout.tsx");
const enLayout = read("../app/(english)/layout.tsx");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const handoff = read("../lib/calculator-rfq-handoff.ts");
const itRfq = read("../app/(public)/distinta/page.tsx");
const enRfq = read("../app/en/distinta/page.tsx");

test("CALC-INT1 protects published IT/EN calculator URLs and reserves untranslated paths", () => {
  assert.deepEqual([...routes.PUBLISHED_CALCULATOR_LOCALES], ["it", "en"]);
  assert.deepEqual([...routes.PLANNED_CALCULATOR_LOCALES], ["de", "fr", "es"]);
  assert.deepEqual(routes.publishedCalculatorAlternatePaths(), {
    it: "/knowledge/tubes", en: "/en/knowledge/tubes",
  });
  assert.equal(routes.CALCULATOR_PUBLIC_ROUTES.it.rfqBill, "/distinta");
  assert.equal(routes.CALCULATOR_PUBLIC_ROUTES.en.rfqBill, "/en/distinta");
  assert.equal(routes.CALCULATOR_PUBLIC_ROUTES.it.documentLanguage, "it");
  assert.equal(routes.CALCULATOR_PUBLIC_ROUTES.en.documentLanguage, "en");
  assert.equal(routes.isPublishedCalculatorLocale("it"), true);
  assert.equal(routes.isPublishedCalculatorLocale("en"), true);
  for (const locale of ["de", "fr", "es", "xx"]) {
    assert.equal(routes.isPublishedCalculatorLocale(locale), false);
  }
  for (const locale of ["de", "fr", "es"]) {
    assert.equal(routes.RESERVED_CALCULATOR_PATHS[locale], `/${locale}/knowledge/tubes`);
    assert.doesNotMatch(sitemap + italian + english, new RegExp(`/${locale}/knowledge/tubes`));
    assert.doesNotMatch(sitemap + italian + english, new RegExp(`\\b${locale}: absoluteUrl`));
  }
});

test("CALC-INT1 keeps reciprocal self-canonicals, HTML language roots and indexed clean URLs", () => {
  assert.match(italian, /canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(english, /canonical: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  for (const page of [italian, english]) {
    assert.match(page, /it: absoluteUrl\("\/knowledge\/tubes"\)/);
    assert.match(page, /en: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  }
  assert.match(itLayout, /<SiteDocument lang="it">/);
  assert.match(enLayout, /<SiteDocument lang="en">/);
  assert.match(sitemap, /url: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(sitemap, /url: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  assert.match(italian, /robotsForParameterizedPage\(hasParameters\)/);
  assert.match(english, /export async function generateMetadata/);
  assert.match(english, /robotsForParameterizedPage\(hasParameters\)/);
  assert.match(english, /const hasParameters = Object\.values\(params\)\.some/);
  assert.doesNotMatch(english, /export const metadata: Metadata/);
});

test("CALC-INT1 preserves shareable input hydration and one shared calculator component", () => {
  for (const page of [italian, english]) {
    for (const key of ["standard", "family", "thickness", "length", "quantity", "target", "density"]) {
      assert.match(page, new RegExp(`\\b${key}\\?: string`));
    }
    assert.match(page, /CalculatorRegionSwitch/);
    assert.match(page, /initialValues=\{initialValues\}/);
  }
  assert.match(english, /export const dynamic = "force-dynamic"/);
  assert.match(calculator, /calculatorRfqFromValues\(currentSnapshot,/);
  assert.match(calculator, /enqueueCalculatorRfq\(window\.sessionStorage, item\)/);
});

test("CALC-INT1 does not change the calc -> public bill -> RFQ handoff contract", () => {
  assert.match(handoff, /CALC_RFQ_HANDOFF_KEY = "sss:calc-rfq-handoff:v1"/);
  assert.match(handoff, /CALC_RFQ_HANDOFF_TTL_MS = 10 \* 60 \* 1000/);
  assert.match(handoff, /version: 1/);
  assert.match(handoff, /validatedCalculatorRfqItem/);
  assert.match(calculator, /window\.location\.assign\(locale === "en" \? "\/en\/distinta" : "\/distinta"\)/);
  assert.match(itRfq, /<BuyerDistintaBuilder/);
  assert.match(enRfq, /<EnglishRfqBillBuilder/);
  assert.match(itRfq, /canonical: absoluteUrl\("\/distinta"\)/);
  assert.match(enRfq, /canonical: absoluteUrl\("\/en\/distinta"\)/);
  assert.doesNotMatch(contract, /fetch\(|createClient\(|cookies\(|localStorage|sessionStorage|dispatchRfq/);
});
