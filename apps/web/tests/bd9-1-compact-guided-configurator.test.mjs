import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const wizard = read("../components/buyer-tube-guided-creator.tsx");
const css = read("../app/globals.css");
const builder = read("../components/buyer-distinta-builder.tsx");
const compactCss = css.slice(css.indexOf("/* BD9.1 —"));

test("BD9.1 preserves the four guided steps, measurement feedback and add action", () => {
  assert.match(wizard, /className="bd6-configurator bd91-compact-configurator"/);
  for (const label of ["Tipo di tubo", "Norma", "Grado acciaio", "Dimensioni assistite", "Anteprima articolo", "Aggiungi alla distinta"]) {
    assert.ok(wizard.includes(label), "Missing wizard step: " + label);
  }
  const labels = ["Tipo di tubo", "Grado acciaio", "Dimensioni assistite"];
  assert.ok(labels.every((label) => wizard.includes(label)));
  assert.match(wizard, /className="sr-only">Grado strutturale/);
  assert.match(wizard, /guidedTubeMeasurement\(draft\)/);
  assert.match(wizard, /onAdd\(draft\)/);
  assert.match(builder, /onDraftChange=\{setPreviewDraft\}/);
  assert.match(builder, /function changeLineStandard\(id: string, standard: string\)/);
});

test("BD9.1 uses a dense 2x2 desktop editor, with dimensions beside grade rather than a full-width row", () => {
  assert.ok(compactCss.startsWith("/* BD9.1"));
  assert.match(compactCss, /\.bd91-compact-configurator \.bd6-wizard-sections/);
  assert.match(compactCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(compactCss, /\.bd91-compact-configurator \.bd6-dimensions/);
  assert.match(compactCss, /grid-column: auto/);
  assert.match(compactCss, /\.bd91-compact-configurator \.bd6-wizard-result/);
  assert.match(compactCss, /flex-wrap: nowrap/);
});

test("BD9.1 mobile form stays single-column, with legible input and 44px actions", () => {
  assert.match(compactCss, /@media \(max-width: 640px\)/);
  assert.match(compactCss, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(compactCss, /min-height: 44px/);
  assert.match(compactCss, /font-size: 16px/);
  assert.match(compactCss, /flex-wrap: wrap/);
  assert.match(compactCss, /\.bd6-wizard-result \.bd6-add-button/);
  assert.match(compactCss, /width: 100%/);
});
