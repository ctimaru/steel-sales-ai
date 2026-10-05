import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const explorer = fs.readFileSync(
  new URL("../components/public-price-list-explorer.tsx", import.meta.url),
  "utf8",
);
const distinta = fs.readFileSync(
  new URL("../components/price-list-distinta.tsx", import.meta.url),
  "utf8",
);
const contract = fs.readFileSync(
  new URL("../lib/distinta.ts", import.meta.url),
  "utf8",
);

test("PL1.8 lets each price-list row enter and leave the distinta", () => {
  assert.match(explorer, /addToDistinta/);
  assert.match(explorer, /removeFromDistinta/);
  assert.match(explorer, /+ Distinta/);
  assert.match(explorer, /✓ In distinta/);
  assert.match(explorer, /selectedItemIds/);
});

test("PL1.8 supports meters, bars and tonnes with explicit bar length", () => {
  assert.match(contract, /"meters" \| "bars" \| "tonnes"/);
  assert.match(contract, /meters = input\.quantity/);
  assert.match(contract, /meters = input\.quantity \* input\.barLengthM/);
  assert.match(contract, /meters = \(input\.quantity \* 1000\) \/ input\.weightKgM/);
  assert.match(distinta, /Barre \/ pezzi/);
  assert.match(distinta, />6 m</);
  assert.match(distinta, />12 m</);
  assert.match(distinta, /value="tonnes" disabled=\{!line\.item\.price_per_t_ready \|\| !weightKgM\}/);
});

test("PL1.8 calculates line tonnes and line total without inventing missing weight", () => {
  assert.match(contract, /tonnes = \(meters \* input\.weightKgM\) \/ 1000/);
  assert.match(contract, /meters \* \(input\.netEurM as number\)/);
  assert.match(contract, /issue: "weight_required"/);
  assert.match(distinta, /Totale riga/);
  assert.match(distinta, /Tonnellate/);
  assert.match(distinta, /Il peso kg\/m è necessario per inserire tonnellate/);
});

test("PL1.8 keeps selected lines coupled to the active manual or saved pricing mode", () => {
  assert.match(explorer, /pricingMode === "manual"/);
  assert.match(explorer, /effectiveDiscountByItem\.get\(item\.item_id\)/);
  assert.match(explorer, /netPricePerMeter\(/);
  assert.match(explorer, /netPricePerTonne\(/);
  assert.match(distinta, /I prezzi seguono lo sconto attivo nel listino/);
});

test("PL1.8 uses a desktop side panel and mobile bottom drawer", () => {
  assert.match(explorer, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(explorer, /<aside className="hidden xl:block">/);
  assert.match(explorer, /fixed bottom-4 right-4/);
  assert.match(explorer, /mobileDistintaOpen/);
  assert.match(explorer, /<PriceListDistinta/);
});

test("PL1.8 remains an in-memory builder; persistence is not silently introduced", () => {
  assert.match(explorer, /useState</);
  assert.doesNotMatch(explorer, /localStorage/);
  assert.doesNotMatch(distinta, /fetch\(/);
  assert.doesNotMatch(distinta, /supabase/);
});
