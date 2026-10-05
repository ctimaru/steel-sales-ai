import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const solver = fs.readFileSync(
  new URL("../lib/reverse-pricing.ts", import.meta.url),
  "utf8",
);
const explorer = fs.readFileSync(
  new URL("../components/public-price-list-explorer.tsx", import.meta.url),
  "utf8",
);
const distinta = fs.readFileSync(
  new URL("../components/price-list-distinta.tsx", import.meta.url),
  "utf8",
);

test("PL1.10 solves target €/t through target €/m and discounted-base-plus-fixed-extra", () => {
  assert.match(
    solver,
    /const targetEurM = \(input\.targetEurT \* input\.weightKgM\) \/ 1000/,
  );
  assert.match(
    solver,
    /\(1 - \(targetEurM - input\.fixedExtraEurM\) \/ input\.baseEurM\) \* 100/,
  );
  assert.match(solver, /discounted_base_plus_fixed_extra/);
  assert.match(explorer, /solveDiscountForTargetEurT/);
});

test("PL1.10 refuses reverse pricing without governed kg/m or a supported formula", () => {
  assert.match(solver, /status: "unsupported_formula"/);
  assert.match(solver, /!input\.pricePerTReady/);
  assert.match(solver, /status: "missing_weight"/);
  assert.match(explorer, /pricePerTReady: row\.price_per_t_ready/);
});

test("PL1.10 bounds commercial discount to 0–100 and rejects impossible targets", () => {
  assert.match(solver, /targetEurM < input\.fixedExtraEurM/);
  assert.match(solver, /status: "target_below_fixed_extra"/);
  assert.match(solver, /targetEurM > grossEurM/);
  assert.match(solver, /status: "target_above_gross_price"/);
  assert.match(solver, /discountPct < 0 \|\| discountPct > 100/);
});

test("PL1.10 adds Target €/t as a third pricing mode without replacing manual or saved pricing", () => {
  assert.match(explorer, /type PricingMode = "manual" \| "saved" \| "target"/);
  assert.match(explorer, /Target €\/t/);
  assert.match(explorer, /Target netto €\/t/);
  assert.match(explorer, /setPricingMode\("manual"\)/);
  assert.match(explorer, /setPricingMode\("saved"\)/);
  assert.match(explorer, /setPricingMode\("target"\)/);
});

test("PL1.10 propagates reverse pricing into the Distinta and aggregate engine", () => {
  assert.match(explorer, /pricingIssue: rowPricing\.pricingIssue/);
  assert.match(explorer, /appliedDiscountPct: rowPricing\.appliedDiscountPct/);
  assert.match(explorer, /netEurM: rowPricing\.netEurM/);
  assert.match(explorer, /netEurT: rowPricing\.netEurT/);
  assert.match(distinta, /pricingIssue\?: string \| null/);
  assert.match(distinta, /line\.pricingIssue \?\? distintaIssueLabel/);
});

test("PL1.10 remains temporary and does not silently save a derived target discount", () => {
  assert.doesNotMatch(solver, /supabase/i);
  assert.doesNotMatch(solver, /fetch\(/);
  assert.doesNotMatch(explorer, /saveDiscountProfile/);
  assert.match(explorer, /Reverse pricing · calcolo dello sconto richiesto per ogni articolo/);
});
