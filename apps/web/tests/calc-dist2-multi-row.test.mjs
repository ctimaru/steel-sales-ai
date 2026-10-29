import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const cart=read("../components/calculator-inline-distinta-experience.tsx");
const css=read("../components/calculator-dense-distinta.module.css");
const domain=read("../lib/calculator-inline-distinta.ts");
const chrome=read("./calc-dist2-chrome-multi-row.mjs");
const workflow=read("../../../.github/workflows/perf2-1-mobile-acceptance.yml");

test("CALC-DIST2: one canonical Distinta editor supports compact batches without changing RFQ data",()=>{
  const out=ts.transpileModule(cart,{compilerOptions:{
    module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve
  },reportDiagnostics:true});
  assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  for(const token of ["count >= 5","compactBatch","data-distinta-batch-toolbar",
    "data-distinta-multi-row-mode","data-distinta-toggle-density","styles.rowsBatch",
    "expandedBatch","calculateBuyerDistintaLine(line)",
    "prepareInlinePrivateRfq(liveState.current, targets, includePrivateTargets)"])
    assert.ok(cart.includes(token),token);
  assert.match(css,/\.rowsBatch \.mainRow/);
  assert.match(css,/\.rowsBatch \.quantity input \{ height:44px/);
  assert.match(domain,/INLINE_DISTINTA_MAX_LINES = 50/);
  assert.match(domain,/editInlineDistintaLine/);
});

test("CALC-DIST2: open editors and quick drafts disable clipboard and RFQ until resolved",()=>{
  assert.match(cart,/hasUnsavedEdits = hasUnsavedQuantity \|\| editingId !== null \|\| editingTargetId !== null/);
  assert.match(cart,/disabled=\{hasUnsavedEdits\} onClick=\{copyBill\}/);
  assert.match(cart,/disabled=\{rfqPending \|\| Boolean\(createdRfq\) \|\| !ready \|\| hasUnsavedEdits\}/);
  assert.match(cart,/if \(hasPendingQuantities\(\) \|\| editingId !== null \|\| editingTargetId !== null\)/);
  assert.match(cart,/disabled=\{count >= INLINE_DISTINTA_MAX_LINES \|\| quickChanged \|\| editing \|\| editingTargetId === line.id\}/);
  assert.match(cart,/data-distinta-unsaved-edits/);
  assert.match(cart,/setQuickQuantities\(current => \{ const next = \{ \.\.\.current \}; delete next\[line.id\]/);
  for(const key of ["it: { back:","en: { back:","de: { back:","fr: { back:","es: { back:"])
    assert.ok(cart.includes(key),key);
  assert.equal((cart.match(/data-create-inline-private-rfq/g)||[]).length,1);
});

test("CALC-DIST2: browser acceptance covers 5-10 lines in all locales and mobile/desktop",()=>{
  for(const token of ["'it','en','de','fr','es'","320,390,1440",
    "data-distinta-multi-row-mode","data-distinta-toggle-density",
    "data-save-quick-quantity","data-inline-bar-length","data-create-inline-private-rfq",
    "scrollHeight","screenshot("])
    assert.ok(chrome.includes(token),token);
  assert.ok(workflow.includes("calc-dist2-chrome-multi-row.mjs"));
});
