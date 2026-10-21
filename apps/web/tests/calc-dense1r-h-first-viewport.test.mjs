import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const src=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const it=src("../app/(italian)/(public)/distinta/page.tsx");
const builder=src("../components/buyer-distinta-builder.tsx");
const shell=src("../components/english-public-subpage.tsx");
const en=src("../app/(english)/en/distinta/page.tsx");
const intl=src("../app/(international-calculator)/[locale]/distinta/page.tsx");
const css=src("../components/buyer-dense-builder.module.css");
test("H: public landing first viewport is compact without hiding commercial actions",()=>{
 for(const code of [it,builder,shell,en,intl]){
  const p=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
  assert.equal(p.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 }
 for(const tag of ["data-public-bill-landing","data-public-bill-hero","data-public-bill-builder","compactLanding",
   "appRoutes.rfqHub.createDistinta"])assert.ok(it.includes(tag),tag);
 for(const x of ["data-public-bill-mobile-compact","data-public-bill-summary","PublicTubeWeightCalculator",
   "onAddToDistinta={addCalculatorLine}","onClick={openPrivateCart}","onClick={allComplete ? (authenticated ? createRfqHub : copyDistinta) : goToIncompleteRow}"])
   assert.ok(builder.includes(x),x);
 assert.match(css,/\.publicMobileLanding/);
 assert.match(css,/bd53-hud-action/);
 assert.match(css,/min-height:44px/);
 assert.ok(en.includes("compactMobileHero"));
 assert.ok(intl.includes('data-rfq-hero="true"'));
 assert.ok(shell.includes("compactMobileHero"));
});
