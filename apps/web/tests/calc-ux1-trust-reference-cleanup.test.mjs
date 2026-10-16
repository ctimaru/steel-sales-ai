import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const helper = read("../lib/tube-reference-evidence.ts");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const italian = read("../app/(public)/knowledge/tubes/page.tsx");
const english = read("../app/en/knowledge/tubes/page.tsx");
const dimension = read("../app/(public)/knowledge/tubes/[slug]/page.tsx");
const rpc = read("../../../supabase/migrations/20260928140000_k6_indexable_dimension_pages.sql");
const { outputText } = ts.transpileModule(helper, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const evidence = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));

const source = (more = {}) => ({
  source_provider: "Metal Service Zwevegem",
  source_name: "P265GH published reference",
  source_url: "https://www.msz.be/upload/file/P265GH_FR_2.pdf",
  weight_method: "published",
  product_family: "round_tube",
  outer_diameter_mm: 48.3, width_mm: null, height_mm: null, thickness_mm: 3.68,
  reference_id: "r1", dimension_slug: "tondo-48-3x3-68", weight_kg_m: 4.05,
  ...more,
});

test("CALC-UX1 source-document mapping identifies P265GH EN 10216-2 only for the known PDF", () => {
  const known = evidence.referenceEvidence(source());
  assert.equal(known.standard, "en10216-2");
  assert.equal(known.grade, "P265GH");
  assert.equal(known.declaredMethod, "published");
  assert.equal(known.sourceConfirmed, true);
  const sameProviderDifferentPdf = evidence.referenceEvidence(source({
    source_url: "https://www.msz.be/upload/file/EN10219_other.pdf",
    source_name: "Generic supplier list",
  }));
  assert.equal(sameProviderDifferentPdf.standard, "unspecified");
  assert.equal(sameProviderDifferentPdf.grade, null);
  assert.equal(sameProviderDifferentPdf.sourceConfirmed, false);
});

test("CALC-UX1 source name and recorded method are separate; no canonical->verified upgrade", () => {
  const verified = evidence.referenceEvidence(source({
    source_provider: "Another source", source_url: "https://example.com/catalogue.pdf",
    source_name: "EN 10219 structural hollow sections", weight_method: "verified",
  }));
  assert.equal(verified.standard, "en10219");
  assert.equal(verified.declaredMethod, "verified");
  assert.equal(evidence.sourceMethodLabel(verified.declaredMethod, "it"), "Classificato verificato");
  assert.equal(evidence.sourceMethodLabel("published", "it"), "Pubblicato da fonte terza");
  assert.equal(evidence.sourceStandardLabel("unspecified", "en"), "Standard not declared");
  assert.equal(evidence.referenceEvidence(source({weight_method:"canonical"})).declaredMethod,"unspecified");
});

test("CALC-UX1 suggestions are short, geometric-near and prohibit cross-standard references", () => {
  const en10219 = source({reference_id:"r2", source_provider:"Another source",source_url:"https://example.com/reference.pdf",source_name:"EN 10219 structural sections",outer_diameter_mm:48.3,thickness_mm:3.7});
  const unrelated = source({reference_id:"r3",source_provider:"Another source",source_url:"https://example.com/reference.pdf",source_name:"Unclassified table"});
  const distant = source({reference_id:"r4",source_provider:"Another source",source_url:"https://example.com/reference.pdf",source_name:"EN 10219 structural sections",outer_diameter_mm:168.3,thickness_mm:15});
  const selected = {family:"round_tube",outerDiameter:48.3,width:null,height:null,thickness:3.7,standard:"en10219"};
  assert.deepEqual(evidence.relatedTubeReferences([source(),en10219,unrelated,distant],selected).map(v=>v.reference_id),["r2"]);
  assert.equal(evidence.relatedTubeReferences([source()],selected).length,0);
  assert.equal(evidence.relatedTubeReferences([source(),en10219],{...selected,standard:"en10210"}).length,0);
  assert.equal(evidence.relatedTubeReferences([source(),en10219],{...selected,standard:"geometric"}).length,0);
});

test("CALC-UX1 public reference catalogue is opt-in while linked SEO entries remain indexable", () => {
  assert.match(calculator, /<details[^>]*data-testid="tube-reference-catalogue"/);
  assert.match(calculator, /familyCount\} \{t\("riferimenti disponibili"\)/);
  assert.match(calculator, /sourceStandardLabel\(evidence.standard, locale === "it" \? "it" : "en"\)/);
  assert.match(calculator, /sourceMethodLabel\(evidence.declaredMethod, locale === "it" \? "it" : "en"\)/);
  assert.match(calculator, /Non equivalente alla norma scelta/);
  assert.match(calculator, /relatedTubeReferences\(references,/);
  assert.match(calculator, /\/knowledge\/tubes\/\$\{reference.dimension_slug\}/);
  assert.match(dimension, /referenceEvidence\(dimension\)/);
  assert.match(dimension, /sourceStandardLabel\(provenance.standard, "it"\)/);
  assert.match(dimension, /EN 10216-2\/P265GH riguarda tubi per impieghi a pressione/);
  assert.match(dimension, /canonical: absoluteUrl/);
  assert.match(dimension, /citation: dimension.source_url/);
  assert.match(rpc,/grant execute.*anon/s);
  assert.match(english, /CalculatorRegionSwitch locale="en" initialRegion="eu"/);
  assert.match(italian, /CalculatorRegionSwitch locale="it" initialRegion="eu"/);
});

test("CALC-UX1 removes escaped literal backslashes between calculator and index without disturbing canonical SEO", () => {
  assert.doesNotMatch(italian, /\/>\\n\\n\s+<section aria-label="Esplora il catalogo per famiglia">/);
  assert.match(italian, /alternates:\s*\{\s*canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(italian, /robotsForParameterizedPage\(hasParameters\)/);
  assert.doesNotMatch(italian + english + calculator, /createClient\(|service_role|\.from\("steel_weight_references"\)/);
});
