import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const modelSource=read("../lib/calculator-dimension-discovery.ts");
const ui=read("../components/calculator-dimension-discovery.tsx");
const calc=read("../components/public-tube-weight-calculator.tsx");
const buyer=read("../components/buyer-distinta-builder.tsx");
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
test("NEXT1C TSX parses; source choices and price/private boundaries retained",()=>{
  for(const s of [modelSource,ui,calc,buyer])assert.equal(transpile(s).diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
  assert.match(calc,/availableDimensions = useMemo/);
  assert.match(calc,/<CalculatorDimensionDiscovery items=\{availableDimensions\}/);
  assert.match(calc,/setThicknessTouched\(true\)/);
  assert.match(calc,/data-cockpit-measurements/);
  assert.match(calc,/data-cockpit-length-quantity/);
  assert.match(buyer,/discoveryOptions=\{discoveredBuyerDimensions\}/);
  assert.match(modelSource,/Only actual published Public Knowledge records/);
  assert.doesNotMatch(ui,/fetch\(|supabase|localStorage|targetEurT|createBuyerRfqCampaign|sendBuyerDistinta/);
  assert.doesNotMatch(modelSource,/fetch\(|supabase|localStorage/);
  assert.match(ui,/aria-live="polite"/);
  assert.match(ui,/locale/);
});
test("NEXT1C pure search handles 3 geometries, comma/dot, source and filters", async()=>{
  // Strip type-only imports and use the test-only TS transpiled pure model.
  const withoutImports=modelSource.split("\n").filter(l=>!l.startsWith("import type")).join("\n");
  const out=ts.transpileModule(withoutImports,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function("module","exports",out)(mod,mod.exports);
  const m=mod.exports;
  const options=[
    {id:"r",family:"round_tube",primaryMm:168.3,secondaryMm:168.3,thicknessMm:6.3,source:"public"},
    {id:"s",family:"square_tube",primaryMm:100,secondaryMm:100,thicknessMm:4,source:"public"},
    {id:"x",family:"rectangular_tube",primaryMm:140,secondaryMm:80,thicknessMm:5,source:"public"},
    {id:"bad",family:"round_tube",primaryMm:30,secondaryMm:30,thicknessMm:16,source:"public"},
    {id:"dup",family:"square_tube",primaryMm:100,secondaryMm:100,thicknessMm:4,source:"other"},
  ];
  assert.equal(m.searchCalculatorDimensions(options,"168,3x6,3").matchCount,1);
  assert.equal(m.searchCalculatorDimensions(options,"168.3x6.3").results[0].id,"r");
  assert.equal(m.searchCalculatorDimensions(options,"100x100x4","square_tube").matchCount,1);
  assert.equal(m.searchCalculatorDimensions(options,"140 x 80 x 5","rectangular_tube").matchCount,1);
  assert.equal(m.searchCalculatorDimensions(options,"", "all",4).matchCount,1);
  assert.equal(m.searchCalculatorDimensions(options,"", "all","all").matchCount,3);
  assert.equal(m.searchCalculatorDimensions(options,"", "all","all",1).results.length,1);
  assert.equal(m.searchCalculatorDimensions(options,"","round_tube").thicknesses.length,1);
  assert.equal(m.validCalculatorDimension(options[3]),false);
});
test("NEXT1C source adapters keep public/provenance and validate size keys",async()=>{
  const mod={exports:{}};
  const out=ts.transpileModule(modelSource.split("\n").filter(l=>!l.startsWith("import type")).join("\n"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("module","exports",out)(mod,mod.exports);
  const m=mod.exports;
  const ref={dimension_slug:"one",product_family:"round_tube",outer_diameter_mm:88.9,width_mm:null,height_mm:null,thickness_mm:5,source_provider:"Reference",source_name:"Document",weight_kg_m:9};
  assert.deepEqual(m.dimensionsFromPublicReferences([ref])[0].source,"Document");
  const opt={id:"two",family:"rectangular_tube",sizeKey:"rectangular_tube:100:50",thicknessMm:4,sourceName:null};
  assert.equal(m.dimensionsFromBuyerCatalog([opt])[0].secondaryMm,50);
  assert.equal(m.dimensionsFromBuyerCatalog([{...opt,sizeKey:"bad:x:y"}]).length,0);
});
