import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const buyer=read("../components/buyer-distinta-builder.tsx");
const shared=read("../components/public-tube-weight-calculator.tsx");
const css=read("../components/buyer-dense-builder.module.css");
test("DENSE1R-F: same public/private calculator with distinct private shell and no hidden business logic",()=>{
 const p=ts.transpileModule(buyer,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
 assert.equal(p.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 for(const selector of ["data-private-calculator-page","data-private-calculator-shell","data-private-calculator-toolbar","data-private-calculator-heading","data-private-calculator-grade"])assert.ok(buyer.includes(selector),selector);
 for(const handler of ["PublicTubeWeightCalculator","discoveryOptions={discoveredBuyerDimensions}","onAddToDistinta={addCalculatorLine}","onClick={openPrivateCart}","onChange={(event) => setTitle(event.target.value)}","onChange={(event) => setQuickGrade(event.target.value)}"])assert.ok(buyer.includes(handler),handler);
 assert.ok(shared.includes("data-cockpit-workspace"));
 assert.match(css,/SAME public\/private EU/);
});
