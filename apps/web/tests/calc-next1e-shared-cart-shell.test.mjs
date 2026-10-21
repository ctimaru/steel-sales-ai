import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const shell = read("../components/technical-cart-shell.tsx");
const css = read("../components/technical-cart-shell.module.css");
const publicExperience = read("../components/calculator-inline-distinta-experience.tsx");
const privateBuilder = read("../components/buyer-distinta-builder.tsx");

test("CALC-NEXT1E: both calculation surfaces share a single technical cart shell", () => {
  assert.match(publicExperience, /import \{ TechnicalCartShell \}/);
  assert.match(privateBuilder, /import \{ TechnicalCartShell \}/);
  assert.equal((publicExperience.match(/<TechnicalCartShell/g) ?? []).length, 1);
  assert.equal((privateBuilder.match(/<TechnicalCartShell/g) ?? []).length, 1);
  assert.doesNotMatch(publicExperience, /createPortal\(/);
  assert.doesNotMatch(privateBuilder, /createPortal\(/);
  assert.match(shell, /createPortal\(/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /onKeyDown/);
  assert.match(shell, /getClientRects\(\)/);
  assert.match(shell, /document\.body\.style\.overflow/);
  assert.match(shell, /origin\.focus\(/);
});

test("CALC-NEXT1E: public/private IDs and privacy boundaries remain different", () => {
  assert.match(publicExperience, /dialogId="distinta-inline-dialog"/);
  assert.match(privateBuilder, /dialogId="buyer-live-preview-dialog"/);
  assert.match(publicExperience, /visible=\{ready && count > 0\}/);
  assert.match(privateBuilder, /visible=\{activeLineCount > 0\}/);
  assert.match(privateBuilder, /pendingFocusRowRef=\{pendingCartRowRef\}/);
  assert.match(privateBuilder, /restoreFocusRef=\{cartReturnFocusRef\}/);
  assert.match(publicExperience, /inlineDistintaTotals\(state\)/);
  assert.match(privateBuilder, /calculateBuyerDistintaTotals\(calculated\)/);
  assert.doesNotMatch(shell, /targetEurT|buyerTargetPreview|createBuyerRfqCampaign|supabase|localStorage/);
  assert.match(css, /var\(--brand-deep/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /safe-area-inset-bottom/);
});

test("CALC-NEXT1E: shared shell TSX parses and keeps responsive dialog layout", () => {
  const output=ts.transpileModule(shell,{compilerOptions:{
    jsx:ts.JsxEmit.Preserve, module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022,
  },reportDiagnostics:true});
  assert.equal(output.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
  assert.match(css, /@media \(min-width: 640px\)/);
  assert.match(css, /\.dialogWide/);
  assert.match(shell, /triggerTestId/);
  assert.match(shell, /overlayTestId/);
});
