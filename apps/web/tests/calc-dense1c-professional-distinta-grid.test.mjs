import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const component = read("../components/calculator-inline-distinta-experience.tsx");
const cartShell = read("../components/technical-cart-shell.tsx");
const cartCss = read("../components/technical-cart-shell.module.css");
const copies = read("../lib/calculator-inline-distinta-copy.ts");
const model = read("../lib/calculator-inline-distinta.ts");
const chrome = read("./calc-dense1c-chrome-quantity-grid.mjs");

test("DENSE1C: compact grid and sticky drawer footer keep one canonical RFQ action", () => {
  for (const source of [component, cartShell, copies]) {
    const out = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve },
      reportDiagnostics: true,
    });
    assert.equal(out.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  }
  for (const marker of [
    "data-distinta-compact-grid", "data-distinta-compact-row", "data-distinta-grid-header",
    "data-inline-quantity", "data-save-quick-quantity", "data-distinta-sticky-footer",
    "editInlineDistintaLine(liveState.current, id, { quantity: value })",
    "hasPendingQuantities()", "onClick={copyBill}",
  ]) assert.ok(component.includes(marker), marker);
  assert.equal(component.split("data-create-inline-private-rfq").length - 1, 1);
  assert.match(cartShell, /footer\?: ReactNode/);
  assert.ok(cartShell.includes("className={styles.footer}"));
  assert.match(cartCss, /\.footer\s*\{/);
});

test("DENSE1C: explicit validated quantity save never writes a second state model or private prices", () => {
  assert.ok(model.includes("EDITABLE_KEYS"));
  assert.ok(model.includes("const next = validatedLine({ ...state.lines[index], ...patch })"));
  assert.ok(component.includes("if (hasPendingQuantities()) { setRfqError(c.unsavedQuantity); return; }"));
  assert.ok(component.includes("if (hasPendingQuantities()) { setMessage(c.unsavedQuantity); return; }"));
  assert.ok(component.includes("setQuickQuantities"));
  assert.ok(component.includes("sessionStorage"));
  assert.ok(component.includes("pruneBuyerTargets(result.state, current)"));
  assert.ok(component.includes("prepareInlinePrivateRfq(liveState.current, targets, includePrivateTargets)"));
  assert.ok(chrome.includes('data-save-quick-quantity'));
  for (const key of ["it:", "en:", "de:", "fr:", "es:"]) assert.ok(copies.includes(key));
  assert.equal((copies.match(/^\s*saveQuantity:\s*"/gm) ?? []).length, 5);
  assert.equal((copies.match(/unsavedQuantity:\s*"/g) ?? []).length, 5);
});
