import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const contract = fs.readFileSync(
  new URL("../lib/distinta.ts", import.meta.url),
  "utf8",
);
const distinta = fs.readFileSync(
  new URL("../components/price-list-distinta.tsx", import.meta.url),
  "utf8",
);
const explorer = fs.readFileSync(
  new URL("../components/public-price-list-explorer.tsx", import.meta.url),
  "utf8",
);

test("PL1.9 aggregates meters, tonnes and value from line calculations", () => {
  assert.match(contract, /calculateDistintaTotals/);
  assert.match(contract, /sum \+ \(line\.meters \?\? 0\)/);
  assert.match(contract, /sum \+ \(line\.tonnes \?\? 0\)/);
  assert.match(contract, /sum \+ \(line\.lineTotalEur \?\? 0\)/);
  assert.match(distinta, /Metri \{totals\.metersComplete \? "totali" : "calcolati"\}/);
  assert.match(distinta, /Tonnellate \{totals\.tonnesComplete \? "totali" : "note"\}/);
  assert.match(distinta, /Valore totale/);
});

test("PL1.9 computes weighted €/t from total value divided by total tonnes, never from line €/t averages", () => {
  assert.match(
    contract,
    /weightedAverageEurT[\s\S]*?totalValueEur \/ totalTonnes/,
  );
  assert.doesNotMatch(contract, /reduce[\s\S]*netEurT/);
  assert.doesNotMatch(contract, /average.*netEurT/i);
  assert.match(distinta, /€\/t medio ponderato/);
  assert.match(distinta, /Media ponderata = valore totale ÷ tonnellate totali/);
});

test("PL1.9 withholds weighted average until every selected line has value and governed tonnes", () => {
  assert.match(contract, /weightedAverageStatus:[\s\S]*"incomplete_lines"/);
  assert.match(contract, /"missing_weight"/);
  assert.match(contract, /completeValueLines\.length === lineCount/);
  assert.match(contract, /weightedReadyLines\.length !== lineCount/);
  assert.match(contract, /weightedAverageStatus === "ready"/);
  assert.match(distinta, /totals\.weightedAverageEurT === null/);
});

test("PL1.9 labels partial aggregates instead of presenting them as complete totals", () => {
  assert.match(distinta, /"Valore calcolato"/);
  assert.match(distinta, /Tonnellate \{totals\.tonnesComplete \? "totali" : "note"\}/);
  assert.match(
    distinta,
    /Il valore mostrato include soltanto le righe con quantità e prezzo calcolabili/,
  );
  assert.match(
    distinta,
    /Le tonnellate mostrate includono soltanto le righe con kg\/m disponibile/,
  );
});

test("PL1.9 preserves PL1.8 line formulas and active pricing coupling", () => {
  assert.match(contract, /meters \* \(input\.netEurM as number\)/);
  assert.match(contract, /tonnes = \(meters \* input\.weightKgM\) \/ 1000/);
  assert.match(explorer, /pricingMode === "manual"/);
  assert.match(explorer, /effectiveDiscountByItem/);
  assert.match(explorer, /netPricePerMeter/);
  assert.match(explorer, /netPricePerTonne/);
});
