import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const wizard = read("../components/buyer-tube-guided-creator.tsx");
const css = read("../app/globals.css");
const guidance = read("../lib/buyer-tube-guidance.ts");
const buyerSource = read("../lib/buyer-distinta.ts").replace(/^import[^;]+;\s*/u, "");
const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const guide = await import("data:text/javascript;base64," + Buffer.from(transpile(guidance)).toString("base64"));
const buyer = await import("data:text/javascript;base64," + Buffer.from(transpile(buyerSource)).toString("base64"));

test("BD8 new article requires its own standard instead of silently reusing previous selection", () => {
  assert.match(wizard, /\.\.\.current, standard: "", diameter: "", side: ""/);
  assert.match(wizard, /onClick=\{\(\) => \{/);
  assert.match(builder, /function changeLineStandard\(id: string, standard: string\)/);
  assert.match(builder, /onChange=\{\(event\) => changeLineStandard\(line\.id, event\.target\.value\)\}/);
  assert.match(builder, /aria-label=\{`Norma della riga \$\{index \+ 1\}\`\}/);
  assert.match(builder, /<option value="EN 10219">EN 10219<\/option>/);
  assert.match(builder, /<option value="EN 10210">EN 10210<\/option>/);
  assert.match(builder, /\{line\.standard \? line\.standard \+ " · " : "Norma da scegliere · "\}/);
});

test("BD8 independently recalculates hot and cold tubes and adds physical totals for both", () => {
  const a = guide.guidedTubeMassKgM("square_tube", "EN 10210", 100, 100, 5);
  const b = guide.guidedTubeMassKgM("square_tube", "EN 10219", 100, 100, 5);
  assert.ok(a > b, "hot and cold section weights must differ");
  const base = {
    description:"Tubo quadro 100 × 100 × 5 mm",
    grade:"S355J2H",finish:"",quantityMode:"bars",quantity:"2",barLengthM:"12",
    targetEurT:"",note:"",
  };
  const hot = buyer.calculateBuyerDistintaLine({
    ...base,id:"hot-1",standard:"EN 10210",weightKgM:a.toFixed(3),
  });
  const cold = buyer.calculateBuyerDistintaLine({
    ...base,id:"cold-2",standard:"EN 10219",weightKgM:b.toFixed(3),
  });
  assert.equal(hot.standard,"EN 10210");
  assert.equal(cold.standard,"EN 10219");
  assert.equal(hot.complete,true);
  assert.equal(cold.complete,true);
  const total=buyer.calculateBuyerDistintaTotals([hot,cold]);
  assert.equal(total.completeLines,2);
  assert.equal(total.totalMeters,48);
  assert.ok(total.totalTonnes > 0.6);
  assert.equal(total.targetTotalEur,null);
  assert.notEqual(hot.weightKgM,cold.weightKgM);
});

test("BD8 updates selected line alone, preserving other lines and existing commercial exports", () => {
  assert.match(builder, /setLines\(\(current\) =>\s*current\.map\(\(line\) => \(line\.id === id \? \{ \.\.\.line, \.\.\.patch \} : line\)\)/);
  assert.match(builder, /guidedTubeMeasurement\(\{ \.\.\.guided, standard \}\)/);
  assert.match(builder, /weightFromCatalogForStandard\(reference, standard\)/);
  assert.match(builder, /setGuidedSpecsByLine\(\(current\) => \(\{/);
  assert.match(builder, /function duplicateLine\(id: string\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /buildBuyerDistintaPlainText\(title, valid, documents\)/);
});

test("BD8 compact rows keep key fields available and details independently expandable", () => {
  assert.match(builder, /className="bd5-row-header"/);
  assert.match(builder, /className="bd5-row-body"/);
  assert.match(builder, /className="bd52-core-fields"/);
  assert.match(builder, /className="bd5-status-badge"/);
  assert.match(builder, /className="bd8-inline-norm bd52-field"/);
  assert.match(builder, /className="bd8-inline-grade bd52-field"/);
  assert.match(builder, /className="bd8-tonnes"/);
  assert.match(builder, /className="bd5-row-action bd8-icon-button"/);
  assert.match(builder, /aria-expanded=\{detailOpen\}/);
  assert.match(builder, /hidden=\{!detailOpen\}/);
  assert.match(css, /BD8 — High-density industrial rows/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
