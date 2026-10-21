import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const row = read("../components/calculator-inline-distinta-experience.tsx");
const shell = read("../components/technical-cart-shell.tsx");
const shellCss = read("../components/technical-cart-shell.module.css");
const compactCss = read("../components/calculator-dense-distinta.module.css");
test("DENSE1R-B compact technical bill is a tabular editor, not a series of tall cards",()=>{
 for(const source of [row,shell]){
   const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
   assert.equal(out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 }
 for(const token of ["data-distinta-tabular-row","data-distinta-grid-header",
   "data-distinta-row-actions","data-inline-quantity","data-save-quick-quantity",
   "calculateBuyerDistintaLine(line)","editInlineDistintaLine(liveState.current, id, { quantity: value })",
   "hasPendingQuantities()","data-create-inline-private-rfq","pruneBuyerTargets(result.state, current)"])
   assert.ok(row.includes(token),token);
 assert.match(row,/compact visible=\{ready/);
 assert.match(shell,/compact\?: boolean/);
 assert.match(shell,/styles.dialogCompact/);
 assert.match(shellCss,/width: min\(460px, 95vw\)/);
 assert.match(compactCss,/grid-template-columns:minmax\(0,1fr\) 62px 79px 120px/);
 assert.match(compactCss,/\.action\{flex-basis:42px;width:42px;height:42px\}/);
 assert.equal((row.match(/data-distinta-row-actions/g)||[]).length,1,"one inline group of actions per row");
});
