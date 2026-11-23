import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

// DISTINTA-SMART1 (founder decision, 23 Nov 2026): step 1 of /rfq-hub/distinta
// is one box (size search or request for the AI assistant) above the Distinta.
// No language bar, no drawer, no second «aggiungi» entry point.

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const toJs = (source) => ts.transpileModule(
  source.replace(/^import[^;]+;\s*/gmu, ""),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText.replace(/^export /gmu, "");
const { smartBoxIntent, readSmartBoxHints } = new Function(
  toJs(read("../lib/distinta-smart-box.ts")) + "\nreturn { smartBoxIntent, readSmartBoxHints };",
)();

const builder = read("../components/buyer-distinta-builder.tsx");
const box = read("../components/distinta-smart-box.tsx");
const sheet = read("../components/distinta-sheet.tsx");

test("a size is a catalog search", () => {
  for (const text of ["quadro 100x100x5", "tondo 60,3x3", "120x80x4", "quadro 100", "100x100x5 S355J2H", "Lamiera S275 sp. 10"]) {
    assert.equal(smartBoxIntent(text, true), "search", text);
  }
  assert.equal(smartBoxIntent("   ", true), "empty");
});

test("quantities, several sizes, several lines or a request go to the assistant", () => {
  for (const text of [
    "40 tubi quadri 100×100×5, S355J2H, EN 10219, 12 m",
    "40 barre quadro 100x100x5",
    "40 quadri 100x100x5",
    "quadro 100x100x5 120 m",
    "2,5 t 60,3x3",
    "100x100x5\n60,3x3",
    "100x100x5 e 60,3x3",
    "cerco quadri 100x100x5",
  ]) {
    assert.equal(smartBoxIntent(text, true), "ai", text);
  }
  // «5 mm» is a thickness, not a quantity.
  assert.equal(smartBoxIntent("quadro 100x100 5 mm", true), "search");
});

test("without the assistant (non Italian bill) everything is a search", () => {
  assert.equal(smartBoxIntent("40 barre quadro 100x100x5", false), "search");
});

test("norm and grade next to a size are applied and removed from the search", () => {
  assert.deepEqual(readSmartBoxHints("quadro 100x100x5 S355J2H EN 10210"),
    { standard: "EN 10210", grade: "S355J2H", query: "quadro 100x100x5" });
  assert.deepEqual(readSmartBoxHints("tondo 60,3x3 s 275"), { standard: null, grade: "S275", query: "tondo 60,3x3" });
  assert.deepEqual(readSmartBoxHints("120x80x4"), { standard: null, grade: null, query: "120x80x4" });
});

test("the focused screen has one input and one Distinta", () => {
  assert.equal((builder.match(/<DistintaSmartBox/g) ?? []).length, 1);
  assert.equal((builder.match(/<DistintaSheet/g) ?? []).length, 1);
  assert.match(builder, /aiEnabled=\{uiLocale === "it"\}/);
  // The language is a small control in the box, the full-width bar is public only.
  assert.match(builder, /corner=\{languageControl\}/);
  assert.match(builder, /\{!focusAiIntake \? \(\s*<div className=\{"flex flex-wrap items-center justify-between gap-2 rounded-xl border/);
  // Picking a size asks only the quantity; unit, length, norm and grade sit behind one toggle.
  assert.match(box, /data-testid="distinta-smart-quantity"/);
  assert.match(box, /aria-expanded=\{optionsOpen\}/);
  assert.match(box, /Chiedi all’assistente/);
  assert.match(box, /come riga libera/);
  assert.match(box, /onPointerMove=/);
  assert.doesNotMatch(box, /onFocus=\{\(\) => setOpen\(true\)\}/);
  // Unpublished sizes follow the norm chosen after picking them.
  assert.match(box, /parseQuickAddMeasure\(selected\.description, standard\)/);
});

test("the Distinta edits rows in place and has one primary action", () => {
  assert.match(sheet, /data-testid="distinta-sheet"/);
  assert.equal((sheet.match(/data-testid="distinta-choose-suppliers"/g) ?? []).length, 1);
  assert.match(sheet, /id="distinta-sheet-title"/);
  assert.match(sheet, /Documenti richiesti/);
  assert.doesNotMatch(sheet, /TechnicalCartShell|Carrello|Aggiungi riga libera/);
  assert.doesNotMatch(builder, /CommercialRfqWorkspace|CommercialRfqLivePreview|DistintaQuickAddBar/);
});

test("DISTINTA-SMART1 TSX parses", () => {
  for (const [name, source] of [["box.tsx", box], ["sheet.tsx", sheet], ["builder.tsx", builder]]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});

// DISTINTA-SMART2 (founder request, 23 Nov 2026): stronger contrast on the three steps.
test("the three steps share one stepper and scoped high-contrast field rules", () => {
  const css = read("../app/globals.css");
  const steps = read("../components/request-steps.tsx");
  const campaign = read("../app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
  const step1 = read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx");
  assert.match(step1, /<div data-distinta-steps /);
  assert.match(campaign, /data-testid="rfq-step3" data-distinta-steps/);
  assert.match(campaign, /data-testid="rfq-step2" data-distinta-steps/);
  assert.match(steps, /aria-current=\{active \? "step" : undefined\}/);
  // Field borders ≥3:1 and placeholders ≥4.5:1 win over the unlayered base rules.
  // The generic field rule must exclude the bare name field: it is more specific than one class.
  assert.match(css, /\[data-distinta-steps\] :is\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\.distinta-bare-field\), select, textarea\) \{\n  border-color: #7a9585;/);
  assert.match(css, /\[data-distinta-steps\] :is\(input:not\(\.distinta-bare-field\), select, textarea\):focus \{/);
  assert.match(css, /::placeholder \{\n  color: #5f7568;/);
  // One focus indicator on the box (wrapper), a title-like Distinta name at rest.
  assert.match(box, /distinta-box-input/);
  assert.match(css, /\.distinta-box-input:focus-visible \{\n  border-color: transparent;\n  outline: none;/);
  assert.match(sheet, /className="distinta-bare-field /);
  assert.match(css, /\.distinta-bare-field \{\n  border-color: transparent;/);
  // No low-contrast greys (<4.5:1 on white) left in the request components.
  for (const [name, source] of [["box", box], ["sheet", sheet], ["steps", steps],
    ["picker", read("../components/rfq-supplier-picker.tsx")], ["dispatch", read("../components/rfq-dispatch-panel.tsx")]]) {
    assert.doesNotMatch(source, /text-\[#(?:6b8475|7b8f82|6b7f73|718078|788d80|b3c4ba)\]/i, name);
  }
});

test("Enter right after typing uses the current text, not the deferred list", () => {
  assert.match(box, /const fresh = deferredValue === value;/);
  assert.match(box, /const list = fresh \? items : listFor\(value, currentHints\);/);
});
