import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const row = read("../components/calculator-inline-distinta-experience.tsx");
const shell = read("../components/technical-cart-shell.tsx");
const shellCss = read("../components/technical-cart-shell.module.css");
const compactCss = read("../components/calculator-dense-distinta.module.css");
test("CALC-DIST1 technical drawer preserves tabular quantity controls in readable compact cards",()=>{
 for(const source of [row,shell]){
   const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
   assert.equal(out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 }
 for(const token of ["data-distinta-tabular-row","data-distinta-grid-header",
   "data-distinta-row-actions","data-inline-quantity","data-inline-bar-length","data-save-quick-quantity",
   "calculateBuyerDistintaLine(line)","editInlineDistintaLine(liveState.current, id, { quantity: value, barLengthM })",
   "hasPendingQuantities()","data-create-inline-private-rfq","pruneBuyerTargets(result.state, current)"])
   assert.ok(row.includes(token),token);
 assert.match(row,/compact visible=\{ready/);
 assert.match(shell,/compact\?: boolean/);
 assert.match(shell,/styles.dialogCompact/);
 assert.match(shellCss,/width:min\(510px,95vw\)/);
 assert.match(compactCss,/\.mainRow/);
 assert.match(compactCss,/grid-template-columns:minmax\(80px,\.8fr\) minmax\(0,2\.1fr\)/);
 assert.match(compactCss,/\.action,.actionDanger,.actionTarget/);
 assert.match(compactCss,/height:44px/);
 assert.equal((row.match(/data-distinta-row-actions/g)||[]).length,1,"one inline group of actions per row");
});
