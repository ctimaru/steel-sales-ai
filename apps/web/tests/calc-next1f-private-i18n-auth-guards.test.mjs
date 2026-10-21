import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const dict=read("../lib/buyer-ui-locale.ts");
const builder=read("../components/buyer-distinta-builder.tsx");
const route=read("../app/(workspace)/rfq-hub/distinta/page.tsx");
const actions=read("../app/(public)/distinta/actions.ts");
const snapshot=read("../app/(workspace)/rfq-hub/distinte/[distintaId]/page.tsx");
const intl=read("../app/(international-calculator)/[locale]/distinta/page.tsx");
const en=read("../app/(english)/en/distinta/page.tsx");
test("NEXT1F allowlisted five locale copies are complete for all keys",()=>{
 const cjs=ts.transpileModule(dict,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function("module","exports",cjs)(mod,mod.exports);
 const m=mod.exports;
 assert.deepEqual(m.buyerUiLocales,["it","en","de","fr","es"]);
 for(const k of Object.keys(m.buyerUiCopy)) for(const lang of m.buyerUiLocales){
   assert.ok(typeof m.buyerUiCopy[k][lang]==="string" && m.buyerUiCopy[k][lang].length>0,k+" "+lang);
 }
 assert.equal(m.safeBuyerUiLocale("de"),"de");
 for(const invalid of ["../de","FR",null,{},["it"],"tr"])assert.equal(m.safeBuyerUiLocale(invalid),"it");
 assert.equal(m.buyerUiText("Crea RFQ privata →","en"),"Create private RFQ →");
 assert.equal(m.buyerUiText("La tua distinta","de"),"Ihre Stückliste");
});
test("NEXT1F workspace remains write-role protected, authorization server-owned",()=>{
 assert.match(route,/requireWorkspaceWriteRole\(appRoutes\.rfqHub\.home\)/);
 assert.match(route,/locale=safeBuyerUiLocale/);
 assert.match(route,/locale=\{locale\}/);
 assert.match(route,/robots: privateNoIndexRobots/);
 assert.match(actions,/auth\.getUser\(\)/);
 assert.match(actions,/\.eq\("owner_user_id", authData\.user\.id\)/);
 assert.match(actions,/\.eq\("owner_user_id", user\.id\)/);
 assert.match(snapshot,/\.eq\("organization_id", context\.organizationId\)/);
 assert.match(snapshot,/canWriteWorkspace\(context\.role\)/);
 assert.match(snapshot,/snapshot\.owner_user_id === context\.userId/);
 assert.match(intl,/<EnglishRfqBillBuilder locale=\{language\}/);
 assert.match(en,/<EnglishRfqBillBuilder/);
 assert.doesNotMatch(route,/force-static|saveBuyerDistinta|createBuyerRfqCampaign/);
});
test("NEXT1F selector is client-only and cannot change existing ownership or draft state",()=>{
 assert.match(builder,/setUiLocale\(safeBuyerUiLocale\(e\.target\.value\)\)/);
 assert.match(builder,/data-testid="buyer-private-language-switch"/);
 assert.match(builder,/t\("Articoli in distinta"\)/);
 assert.match(builder,/t\("Righe pronte"\)/);
 assert.match(builder,/locale=\{uiLocale\} onAddToDistinta=\{addCalculatorLine\}/);
 assert.match(builder,/createPrivateRfqOneStep\(/);
 assert.match(builder,/buyerDraftKey\(authenticated \? userId : null, workspace \? organizationId : null\)/);
 assert.match(route,/organizationId=\{context\.organizationId\}/);
 assert.match(builder,/window\.sessionStorage/);
 assert.match(builder,/returnToCommercial/);
 assert.match(builder,/TechnicalCartShell/);
 assert.doesNotMatch(dict,/createClient|sendBuyerDistinta|secret|supabase/);
 for(const file of [dict,builder,route]){
  const output=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(output.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 }
});
