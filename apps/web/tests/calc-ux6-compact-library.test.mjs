import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url),"utf8");
const calc=read("../components/public-tube-weight-calculator.tsx");
const dense=read("../components/calculator-dense-cockpit.module.css");
const cinematic=read("../components/calculator-cinematic.module.css");
const chrome=read("./calc-ux6-chrome-utilities.mjs");
const workflow=read("../../../.github/workflows/perf2-1-mobile-acceptance.yml");

test("CALC-UX6: valid TSX, unchanged weight and RFQ contracts",()=>{
  const out=ts.transpileModule(calc,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});
  const errors=out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error)??[];
  assert.equal(errors.length,0,JSON.stringify(errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText," "))));
  for(const token of ["resolveCommercialBarQuantity(","calculatorRfqFromValues(currentSnapshot,",
    "data-cockpit-workspace","data-cockpit-results","data-cockpit-add","data-commercial-targets"])
    assert.ok(calc.includes(token),token);
});

test("CALC-UX6: no repeated copy panel or section area; keep measured geometry",()=>{
  assert.equal((calc.match(/data-cinematic-copy/g)||[]).length,1);
  assert.ok(calc.includes('data-calc-copy-link'));
  assert.ok(calc.includes('data-calc-copy-actions'));
  assert.ok(calc.includes('data-cinematic-geometry'));
  assert.ok(calc.includes('data-calc-library'));
  assert.ok(!calc.includes('className={cinematic.sectionMetric}'));
  assert.ok(!calc.includes('group/extra mt-1'));
  assert.ok(!calc.includes('Aggiungi ai preferiti ☆'));
  assert.ok(dense.includes('grid-template-columns:minmax(0,1fr) minmax(0,1.15fr)'));
  assert.ok(cinematic.includes('[data-calc-copy-actions] .copy'));
});

test("CALC-UX6: local persistence happens before success and restores the exact quantity",()=>{
  assert.match(calc,/if \(!writeStoredCalculations\(WC4_FAVORITES_KEY, next\)\) return false/);
  assert.match(calc,/setCommercialQuantity\(null\);\s*setQuantity\(calculation.quantity\)/);
  assert.match(calc,/const saved = saveFavorites\(next\)/);
  assert.match(calc,/setActionFeedback\(!saved \? utilityCopy.storage/);
  assert.match(calc,/aria-pressed=\{currentIsFavorite\}/);
  assert.match(calc,/data-calc-save-favorite/);
  assert.ok(calc.includes('window.localStorage.setItem(key, JSON.stringify(calculations))'));
  for(const language of ['it:','en:','de:','fr:','es:']) assert.ok(calc.includes(language));
});

test("CALC-UX6: browser verifies persistent favorites, clipboard, responsive UI",()=>{
  for(const needle of ["'it','en','de','fr','es'","320,1440","data-calc-save-favorite",
    "data-calc-copy-link","data-cinematic-copy","localStorage","reload(","clipboard.readText",
    "data-calc-library"]) assert.ok(chrome.includes(needle),needle);
  assert.ok(workflow.includes("calc-ux6-chrome-utilities.mjs"));
});
