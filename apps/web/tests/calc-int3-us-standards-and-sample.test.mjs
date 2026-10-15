import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
async function loadPure(path) {
  const code = read(path);
  const js = ts.transpileModule(code, {
    compilerOptions: { module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022 },
  }).outputText;
  return await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}
const [registry,sample,engine] = await Promise.all([
  loadPure("../lib/calculator-standards-registry.ts"),
  loadPure("../lib/us-pipe-catalog-sample.ts"),
  loadPure("../lib/international-tube-mass.ts"),
]);
const ui = read("../components/us-pipe-sample-calculator.tsx");
const en = read("../app/en/knowledge/tubes/american-pipe/page.tsx");
const it = read("../app/(public)/knowledge/tubes/tubi-americani/page.tsx");
const enOriginal = read("../app/en/knowledge/tubes/page.tsx");
const itOriginal = read("../app/(public)/knowledge/tubes/page.tsx");
const sitemap = read("../app/sitemap.ts");
const handoff = read("../lib/calculator-rfq-handoff.ts");

test("CALC-INT3 EN 10219 and EN 10210 remain the only live nominal standard methods", () => {
  const live = registry.CALCULATOR_STANDARDS.filter(s=>s.status==="calculator-live");
  assert.deepEqual(live.map(s=>s.id),["en10219","en10210"]);
  for(const x of live){
    assert.equal(x.role,"calculation-method");
    assert.deepEqual([...x.shapes],["chs","shs","rhs"]);
  }
  assert.equal(engine.calculateTubeSection({shape:"square",standard:"en10219",widthMm:100,thicknessMm:5}).ok,true);
  assert.equal(engine.calculateTubeSection({shape:"square",standard:"en10210",widthMm:100,thicknessMm:5}).ok,true);
  assert.equal(engine.calculateTubeSection({shape:"square",standard:"api5l",widthMm:100,thicknessMm:5}).ok,false);
  assert.match(itOriginal,/EN 10210/);
  assert.match(enOriginal,/EN 10219/);
});

test("CALC-INT3 API 5L 47th is a product context, not a calculator method or conformity claim", () => {
  const api=registry.standardById("api5l");
  assert.equal(api.organization,"API");
  assert.equal(api.role,"product");
  assert.equal(api.status,"context-only");
  assert.match(api.title,/47th edition, 2026/);
  assert.match(api.noteEn,/not a mass formula/);
  assert.match(api.noteEn,/not a 47th-edition certification/);
  assert.equal(registry.standardById("asme-b3610").role,"dimensional");
  assert.equal(registry.standardById("astm-a53").role,"product");
  assert.equal(registry.standardById("astm-a106").role,"product");
  assert.equal(registry.standardById("astm-a500").role,"product");
  assert.match(registry.standardById("astm-a500").noteEn,/Do NOT assume EN 10219/);
  assert.equal(registry.standardById("asme-b3619").status,"planned");
  assert.equal(registry.standardById("api5ct").status,"planned");
  assert.equal(registry.standardById("not-a-standard"),null);
});

test("CALC-INT3 limited US manufacturer sample is exactly provenance-located and distinct from ASME tables", () => {
  assert.equal(sample.US_PIPE_MANUFACTURER_SAMPLE.length,20);
  assert.deepEqual(sample.availableUsNps(),["2","2 1/2","3","4","6","8","10","12"]);
  assert.equal(sample.rowsForNps("6").length,4);
  assert.equal(sample.findUsPipeSample("6-40").publishedWeightKgM,28.26);
  assert.equal(sample.findUsPipeSample("6-40").publishedWeightLbFt,18.99);
  assert.equal(sample.findUsPipeSample("6-40").sourcePage,49);
  assert.equal(sample.findUsPipeSample("12-STD").schedule,"STD");
  assert.equal(sample.findUsPipeSample("missing"),null);
  assert.equal(new Set(sample.US_PIPE_MANUFACTURER_SAMPLE.map(x=>x.id)).size,20);
  for(const row of sample.US_PIPE_MANUFACTURER_SAMPLE){
    assert.ok(row.thicknessMm>0 && row.outerDiameterMm>2*row.thicknessMm);
    assert.ok(row.publishedWeightLbFt>0 && row.publishedWeightKgM>0);
    if (row.sourcePage != null) assert.ok(row.sourcePage>=49 && row.sourcePage<=63);
    else assert.match(row.sourceLocation ?? "",/Pipe Tables · NPS/);
    assert.equal(sample.rowsForNps(row.nps).some(r=>r.id===row.id),true);
    // Published weights have independently rounded catalog values, not exactly
    // the same as calculating with rounded dimensions.
    assert.ok(Math.abs(row.publishedWeightLbFt*sample.US_PIPE_MASS_CONVERSION-row.publishedWeightKgM)<0.025);
  }
  assert.match(read("../lib/us-pipe-catalog-sample.ts"),/NOT ASME normative tables/);
  assert.match(read("../lib/us-pipe-catalog-sample.ts"),/supabase\/migrations\/20260920174500/);
});

test("CALC-INT3 uses shared engine for all manufacturer sample sizes and separate published weight",()=>{
  for (const row of sample.US_PIPE_MANUFACTURER_SAMPLE) {
    const result=engine.estimatePublicTubeMass({shape:"round",standard:"geometric",
      outerDiameterMm:row.outerDiameterMm,thicknessMm:row.thicknessMm,
      lengthM:12,bars:4});
    assert.equal(result.ok,true,row.id);
    const expected=Math.PI*row.thicknessMm*(row.outerDiameterMm-row.thicknessMm)*7850/1_000_000;
    assert.ok(Math.abs(result.weightKgM-expected)<1e-10);
    assert.ok(Math.abs(result.totalKg-expected*48)<1e-9);
  }
  assert.match(ui,/estimatePublicTubeMass\(/);
  assert.match(ui,/publishedWeightKgM/);
  assert.match(ui,/publishedWeightLbFt/);
  assert.match(ui,/standard:"geometric"/);
  assert.doesNotMatch(ui,/standard:"api5l"|standard:"astm-a53"/);
});

test("CALC-INT3 new multilingual SEO landings have reciprocal self-canonicals and two sitemap entries",()=>{
  assert.match(it,/canonical: absoluteUrl\(path\)/);
  assert.match(en,/canonical: absoluteUrl\(path\)/);
  assert.match(it,/languages: \{ it: absoluteUrl\(path\), en: absoluteUrl\(other\) \}/);
  assert.match(en,/languages: \{ it: absoluteUrl\(other\), en: absoluteUrl\(path\) \}/);
  assert.match(it,/CalculatorRegionSwitch locale="it" initialRegion="us"/);
  assert.match(en,/CalculatorRegionSwitch locale="en" initialRegion="us"/);
  assert.match(itOriginal,/href="\/knowledge\/tubes\/tubi-americani"/);
  assert.match(enOriginal,/href="\/en\/knowledge\/tubes\/american-pipe"/);
  for(const uri of ["/knowledge/tubes/tubi-americani","/en/knowledge/tubes/american-pipe"]){
    assert.ok(sitemap.includes(`url: absoluteUrl("${uri}")`));
  }
  assert.match(itOriginal,/canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(enOriginal,/canonical: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
});

test("CALC-INT3 US RFQ transition is explicit geometric prefill, with no API/ASTM v1 schema corruption",()=>{
  assert.match(ui,/standard:"geometric",family:"round_tube"/);
  assert.match(ui,/new URLSearchParams\(/);
  assert.match(ui,/copy\.bridge/);
  assert.match(ui,/clipboard\.writeText/);
  assert.match(ui,/const calculatorUrl/);
  assert.match(handoff,/CALC_RFQ_HANDOFF_KEY = "sss:calc-rfq-handoff:v1"/);
  assert.doesNotMatch(ui,/enqueueCalculatorRfq|dispatchRfq|createClient\(|supabase/);
  assert.doesNotMatch(ui,/fetch\(|service_role/);
});
