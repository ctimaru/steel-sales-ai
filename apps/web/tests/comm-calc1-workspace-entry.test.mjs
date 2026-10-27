import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const access = read("../components/commercial-calculator-quick-access.tsx");

test("COMM-CALC1 Commerciale exposes the shared calculator without a second calculator engine", () => {
  assert.match(commercial, /<CommercialCalculatorQuickAccess references=\{calculatorReferences\}/);
  assert.match(commercial, /listPublicTubeDimensionPages\(\)/);
  assert.match(access, /<CalculatorRegionSwitch locale="it" initialRegion="eu" references=\{references\}/);
  assert.match(access, /setOpen\(true\)/);
  assert.match(access, /aria-modal="true"/);
  assert.match(access, /data-commercial-calculator-panel/);
  assert.doesNotMatch(access, /<iframe|\/knowledge\/tubes|<BuyerDistintaBuilder/);
  assert.match(commercial, /<BuyerDistintaBuilder/);
});
