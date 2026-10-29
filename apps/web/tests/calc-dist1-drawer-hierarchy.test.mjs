import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const cart=read("../components/calculator-inline-distinta-experience.tsx");
const shell=read("../components/technical-cart-shell.tsx");
const css=read("../components/calculator-dense-distinta.module.css");
const shellCss=read("../components/technical-cart-shell.module.css");
const browser=read("./calc-dist1-chrome-drawer.mjs");
const workflow=read("../../../.github/workflows/perf2-1-mobile-acceptance.yml");

test("CALC-DIST1: technical drawer is one shared modal with its own back control, not two closes",()=>{
  for(const source of [cart,shell]){
    const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
    assert.equal(out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
  }
  for(const mark of ["countLabel={(count === 1 ? c.row : c.lines).toLowerCase()}",
    "closeLabel={drawerCopy.back}","data-technical-cart-variant",
    "data-distinta-count-badge","data-cart-back","role=\"dialog\" aria-modal=\"true\""])
    assert.ok((shell+cart).includes(mark),mark);
  assert.ok(shellCss.includes("width:min(510px,95vw)"));
  assert.ok(shellCss.includes("height:auto"));
  assert.ok(shellCss.includes("align-self:center"));
  assert.ok(shellCss.includes("max-height:calc(100dvh - 225px)"));
  assert.ok(shellCss.includes(".dialogCompact .header"));
  assert.match(shell,/event\.key === "Escape"/);
  assert.match(shell,/restoreFocusRef/);
});

test("CALC-DIST1: bars, metres and tonnes have own visible titles, controls stay functional",()=>{
  for(const mark of ["data-distinta-compact-row","data-inline-quantity",
    'className={styles.fieldLabel}',"data-distinta-row-actions",
    "className={styles.actionDanger}","className={styles.actionTarget}",
    "data-inline-bar-length","data-save-quick-quantity",
    "duplicateInlineDistintaLine(liveState.current, line.id, makeId())",
    "removeInlineDistintaLine(liveState.current, line.id)",
    "calculateBuyerDistintaLine(line)"])
    assert.ok(cart.includes(mark),mark);
  assert.match(css,/\.row\s*\{/);
  assert.match(css,/\.description \{ grid-column:1\/-1/);
  assert.match(css,/\.metrics \{/);
  assert.match(css,/\.weightLine/);
  assert.match(css,/\.actionDanger/);
  assert.match(css,/height:44px/);
});

test("CALC-DIST1: exactly one primary RFQ action and compact privacy content",()=>{
  assert.equal((cart.match(/data-create-inline-private-rfq/g)||[]).length,1);
  assert.ok(cart.includes("data-distinta-footer-actions"));
  assert.ok(cart.includes("data-distinta-sticky-footer"));
  assert.ok(cart.includes("data-distinta-feedback"));
  assert.ok(cart.includes("data-distinta-privacy-info"));
  assert.ok(cart.includes("drawerCopy.help"));
  assert.ok(cart.includes("c.targetSafety"));
  assert.ok(cart.includes("includePrivateTargets"));
  assert.ok(cart.includes("prepareInlinePrivateRfq(liveState.current, targets, includePrivateTargets)"));
  assert.ok(cart.includes("hasPendingQuantities()"));
  assert.ok(!shell.includes("createBuyerRfqCampaign"));
  for(const locale of ["it: { back:","en: { back:","de: { back:","fr: { back:","es: { back:"])
    assert.ok(cart.includes(locale),locale);
});

test("CALC-DIST1: responsive Chrome is wired into protected visual acceptance",()=>{
  for(const needle of ["'it','en','de','fr','es'","320,390,1440",
    "data-distinta-compact-row","data-distinta-privacy-info","data-create-inline-private-rfq",
    "data-cart-back","screenshot(","data-inline-quantity"])
    assert.ok(browser.includes(needle),needle);
  assert.ok(workflow.includes("calc-dist1-chrome-drawer.mjs"));
});
