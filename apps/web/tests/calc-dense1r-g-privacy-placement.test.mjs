import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const src=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const consent=src("../components/google-analytics-consent.tsx");
const css=src("../components/calculator-consent-placement.module.css");
test("G: privacy placement is route and viewport scoped without modifying consent decision",()=>{
 const out=ts.transpileModule(consent,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
 assert.equal(out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 for(const token of ['flowPrivacyOnMobile','styles.calculatorMobileFlow','data-testid="privacy-reopen-button"',
   'setSettingsOpen(true)','choose("denied")','choose("granted")','analyticsConsentRecordIsCurrent(stored)'])
   assert.ok(consent.includes(token),token);
 assert.match(css,/@media \(max-width:639px\)/);
 assert.match(css,/position:relative/);
 assert.match(css,/min-height:44px/);
 assert.match(consent,/aria-modal="false"/);
});
