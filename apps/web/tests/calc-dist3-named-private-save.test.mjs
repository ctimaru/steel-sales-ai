import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const panel=read("../components/calculator-inline-distinta-experience.tsx");
const server=read("../app/(italian)/(public)/distinta/actions.ts");
const route=read("../lib/routes.ts");
const entry=read("../components/commercial-calculator-quick-access.tsx");
const styles=read("../components/calculator-dense-distinta.module.css");
const publicCart=read("./calc-dist1-chrome-drawer.mjs");
const mixed=read("./calc-dist2-chrome-mixed-materials.mjs");
const dispatch=read("../components/rfq-dispatch-panel.tsx");

test("CALC-DIST3: all changes are syntactically valid and five languages have named private save and supplier preparation",()=>{
  for(const source of [panel,server,entry]) {
    const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
    assert.deepEqual((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>d.messageText),[]);
  }
  for(const lang of ["it","en","de","fr","es"]) assert.ok(panel.includes('"'+lang+'":{"defaultTitle"'),lang);
  for(const marker of ["data-distinta-name-field","data-save-private-distinta","data-distinta-saved-link",
    "data-commercial-saved-distinte-link","data-create-inline-private-rfq"])
    assert.ok(panel.includes(marker),marker);
  assert.ok(panel.includes("maxLength={120}"));
  assert.match(server,/input\.title\.trim\(\)\.length > 120/);
  assert.ok(route.includes('savedDistinte: "/rfq-hub/distinte"'));
  assert.ok(route.includes('savedDistinta: (id: string) =>'));
  assert.ok(entry.includes('data-commercial-saved-distinte-entry'));
  assert.ok(publicCart.includes('count(),3'));
});

test("CALC-DIST3: saving a private named bill is not the supplier dispatch operation",()=>{
  const saveFn=panel.slice(panel.indexOf("async function savePrivateBill()"),panel.indexOf("async function createPrivateRfq()"));
  assert.ok(saveFn.includes("saveBuyerDistinta("));
  assert.ok(!saveFn.includes("createBuyerRfqCampaign("));
  assert.ok(!saveFn.includes("createPrivateRfqOneStep("));
  assert.ok(!saveFn.includes("router.push("));
  assert.ok(saveFn.includes('inlinePrivateRfqAccess()'));
  assert.ok(saveFn.includes("savedSnapshotRef.current = {signature,id:result.distintaId}"));
  const prepareFn=panel.slice(panel.indexOf("async function createPrivateRfq()"),panel.indexOf("function copyBill()"));
  assert.ok(prepareFn.includes("createPrivateRfqOneStep("));
  assert.ok(prepareFn.includes("createBuyerRfqCampaign(savedId)"));
  assert.ok(prepareFn.includes("privateRfqSnapshotSignature(snapshot)"));
  assert.ok(prepareFn.includes("router.push(appRoutes.rfqHub.campaign(result.rfqId))"));
  assert.ok(panel.includes("Prepara invio ai fornitori"));
  assert.ok(panel.includes("Nessun fornitore contattato"));
  assert.ok(panel.includes("includePrivateTargets"));
  assert.ok(panel.includes("savedMatches && savedDistintaId"));
  assert.ok(server.includes('buyer_create_distinta_snapshot'));
  assert.ok(!saveFn.includes("sessionStorage.setItem"));
});

test("CALC-DIST3: shorter cards retain 44px touch controls and existing heterogeneous line coverage",()=>{
  assert.match(styles,/\.row\s*\{\s*min-width:0; padding:8px 10px/);
  assert.match(styles,/\.action,\.actionDanger,\.actionTarget\s*\{[\s\S]*?height:44px/);
  assert.match(styles,/\.rowsBatch \.row \{ padding:6px 9px/);
  assert.ok(mixed.includes("8 different real geometry configurations")||mixed.includes("heterogeneous materials"));
  assert.ok(mixed.includes("targetEurT"));
  // Supplier delivery is a later step gated by explicit recipient review.
  assert.ok(dispatch.includes("confirmChecked"));
  assert.ok(dispatch.includes("suppliers.length < 1"));
  assert.ok(dispatch.includes("expectedSupplierIds: suppliers.map"));
});
