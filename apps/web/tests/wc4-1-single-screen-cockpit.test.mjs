import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url),
  "utf8",
);

test("WC4.1 makes the calculator the first-screen utility", () => {
  assert.doesNotMatch(page, /<SchoolHero/);
  assert.match(page, /<CalculatorRegionSwitch/);
  assert.match(calculator, /scroll-mt-20/);
  assert.match(calculator, /overflow-hidden/); // Rounded card clipping only.
  assert.doesNotMatch(calculator, /lg:h-\[calc\(100svh-6\.75rem\)\]/);
  assert.doesNotMatch(calculator, /lg:max-h-\[820px\]/);
});

test("WC4.1 compacts standard and shape selection into dense controls", () => {
  assert.match(calculator, /role="group" aria-label=\{t\("Norma"\)\}/);
  assert.match(calculator, /role="group" aria-label=\{t\("Sagoma"\)\}/);
  assert.match(calculator, /compactSegmentBase} min-h-11/);
  assert.match(calculator, /sm:min-h-9/);
  assert.match(calculator, /h-5 w-5 shrink-0/);
  assert.doesNotMatch(calculator, /group flex min-h-14 flex-col/);
});

test("WC4.1 keeps the key workflow in one cockpit", () => {
  for (const label of [
    "Norma",
    "Sagoma",
    "Misure",
    "Lunghezza barra",
    "Numero barre",
    "Tonnellate target",
    "Peso per barra",
    "Metri totali",
    "Peso totale",
  ]) {
    assert.match(calculator, new RegExp(label));
  }
});

test("WC4.1 keeps secondary information collapsible", () => {
  assert.match(calculator, /Metodo e provenienza/);
  assert.match(calculator, /Ultimi calcoli e preferiti/);
  assert.match(calculator, /<details/);
  assert.match(calculator, /<summary/);
});

test("WC4.1 preserves the compact parametric diagram on desktop", () => {
  assert.match(calculator, /hidden lg:block/);
  assert.match(calculator, /<ParametricShapeDiagram/);
  assert.match(calculator, /max-w-\[13rem\] lg:max-w-\[15rem\]/);
});

test("WC4.1 keeps the result dominant and actions immediately reachable", () => {
  assert.match(calculator, /text-4xl font-semibold/);
  assert.match(calculator, /Copia risultato/);
  assert.match(calculator, /Copia link/);
  assert.match(calculator, /Aggiungi ai preferiti/);
  assert.match(calculator, /Salva il Calcolatore/);
});
