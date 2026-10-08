import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const calc = read("../lib/buyer-distinta.ts");
const builder = read("../components/buyer-distinta-builder.tsx");
const actions = read("../app/(public)/distinta/actions.ts");
const rfqComparison = read("../components/rfq-quote-comparison.tsx");
const awardPanel = read("../components/rfq-award-panel.tsx");
const migration = read("../../../supabase/migrations/20261008162000_bd3_optional_target_rfqh_consistency.sql");

test("BD3 accepts missing target but rejects a nonpositive target explicitly entered", () => {
  assert.match(calc, /const targetValid = String\(input\.targetEurT \?\? ""\)\.trim\(\) === "" \|\| targetEurT !== null/);
  assert.match(calc, /targetValid &&/);
  assert.doesNotMatch(calc, /targetEurT !== null &&\s*targetEurM !== null &&/);
  assert.match(builder, /Target €\/t \(facoltativo\)/);
  assert.match(builder, /il Target €\/t è facoltativo/i);
  assert.match(actions, /Completa articolo, quantità e peso kg\/m/);
});

test("BD3 preserves NULL targets through totals, saved snapshots and supplier email", () => {
  assert.match(calc, /everyLineHasTarget/);
  assert.match(calc, /targetTotalEur: everyLineHasTarget/);
  assert.match(calc, /: null,/);
  assert.match(actions, /target_eur_t: line\.targetEurT/);
  assert.match(actions, /row\.target_eur_t == null \? null : Number\(row\.target_eur_t\)/);
  assert.match(actions, /row\.target_eur_m == null \? null : Number\(row\.target_eur_m\)/);
  assert.match(builder, /calculated\.filter\(\(line\) => line\.complete\)/);
  assert.match(builder, /Copia distinta/);
  assert.match(builder, /createBuyerRfqCampaign/);
});

test("BD3 database keeps optional monetary fields nullable, consistent and scoped", () => {
  for (const column of ["target_eur_t", "target_eur_m", "target_total_eur"]) {
    assert.match(migration, new RegExp("alter column " + column + " drop not null"));
  }
  assert.match(migration, /bd3_target_fields_all_or_none/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.rfqh5_quote_comparison/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.rfqh7_confirm_award_impl/);
  assert.match(migration, /when count\(\*\) filter\(where target_eur_t is null\)>0 then null/);
  assert.match(migration, /when count\(\*\) filter\(where l\.target_eur_t is null\)>0 then null/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path TO ''/);
});

test("BD3 UI never converts absent savings and price targets into zero", () => {
  assert.match(rfqComparison, /if \(value == null \|\| value === ""\) return null/);
  assert.match(awardPanel, /if \(value == null \|\| value === ""\) return null/);
  assert.match(awardPanel, /targetTotal === null \? null : targetTotal - awardedTotal/);
});
