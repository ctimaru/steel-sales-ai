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

test("WC4 keeps retention local and anonymous-first", () => {
  assert.match(calculator, /sss\.weightCalculator\.recents\.v1/);
  assert.match(calculator, /sss\.weightCalculator\.favorites\.v1/);
  assert.match(calculator, /sss\.weightCalculator\.savedTool\.v1/);
  assert.match(calculator, /window\.localStorage/);
  assert.match(calculator, /Nessuna misura o quantità viene inviata al backend/);
});

test("WC4 records and restores recent calculations", () => {
  assert.match(calculator, /WC4_MAX_RECENTS = 6/);
  assert.match(calculator, /setRecentCalculations/);
  assert.match(calculator, /window\.setTimeout/);
  assert.match(calculator, /restoreCalculation/);
  assert.match(calculator, /Calcolo ripristinato/);
  assert.match(calculator, /Ultimi calcoli/);
  assert.match(calculator, /Ripristina/);
});

test("WC4 supports explicit favorites", () => {
  assert.match(calculator, /WC4_MAX_FAVORITES = 8/);
  assert.match(calculator, /favoriteCalculations/);
  assert.match(calculator, /currentIsFavorite/);
  assert.match(calculator, /Aggiungi ai preferiti/);
  assert.match(calculator, /Preferito ★/);
  assert.match(calculator, /aria-pressed=\{currentIsFavorite\}/);
});

test("WC4 can copy a commercial result and a shareable URL", () => {
  assert.match(calculator, /copyTextToClipboard/);
  assert.match(calculator, /Smart Steel Sales/);
  assert.match(calculator, /Copia risultato/);
  assert.match(calculator, /Copia link/);
  assert.match(calculator, /params\.set\("standard", calculation\.standard\)/);
  assert.match(calculator, /params\.set\("family", calculation\.family\)/);
  assert.match(calculator, /params\.set\("thickness", calculation\.thickness\)/);
  assert.match(calculator, /params\.set\("length", calculation\.length\)/);
  assert.match(calculator, /params\.set\("quantity", calculation\.quantity\)/);
  assert.match(calculator, /#calcolatore-pesi/);
});

test("WC4 shared URLs restore the full calculator state", () => {
  assert.match(page, /standard\?: string/);
  assert.match(page, /target\?: string/);
  assert.match(page, /supportedStandards/);
  assert.match(page, /standard: supportedStandards\.has/);
  assert.match(page, /targetTonnes: params\.target/);
  assert.match(calculator, /initialValues\?\.standard \?\? "en10219"/);
  assert.match(calculator, /initialValues\?\.targetTonnes \?\? ""/);
});

test("WC4 Save Calculator persists a reopen configuration without overriding a shared URL", () => {
  assert.match(calculator, /Salva il Calcolatore/);
  assert.match(calculator, /Calcolatore salvato ✓/);
  assert.match(calculator, /WC4_SAVED_TOOL_KEY/);
  assert.match(calculator, /writeSavedCalculator/);
  assert.match(calculator, /if \(!retentionReady \|\| !calculatorSaved \|\| !currentSnapshot\) return/);
  assert.match(calculator, /hasSharedState/);
  assert.match(calculator, /if \(!hasSharedState && saved\?\.key\) restoreCalculation\(saved\)/);
});
