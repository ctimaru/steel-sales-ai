import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const baseMigration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006115418_rfqh5_quote_normalization_comparison.sql", import.meta.url),
  "utf8",
);
const quantityHardening = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006115741_rfqh5_quantity_coverage_hardening.sql", import.meta.url),
  "utf8",
);
const comparison = fs.readFileSync(
  new URL("../components/rfq-quote-comparison.tsx", import.meta.url),
  "utf8",
);
const buyerPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);

test("RFQH5 comparison RPC is buyer-only and keeps RLS in force", () => {
  assert.match(baseMigration, /security invoker/);
  assert.match(baseMigration, /auth\.uid\(\) is null/);
  assert.match(baseMigration, /owner_user_id=auth\.uid\(\)/);
  assert.match(baseMigration, /grant execute on function public\.rfqh5_quote_comparison\(uuid\) to authenticated/);
  assert.doesNotMatch(baseMigration, /grant execute on function public\.rfqh5_quote_comparison\(uuid\) to anon/);
  assert.doesNotMatch(baseMigration, /security definer/i);
});

test("RFQH5 compares the latest submitted or superseded commercial quote", () => {
  assert.match(baseMigration, /status in \('submitted','superseded'\)/);
  assert.match(baseMigration, /distinct on \(q\.supplier_id\)/);
  assert.match(baseMigration, /revision_in_progress/);
  assert.match(comparison, /nuova revisione in corso/);
});

test("RFQH5 keeps normalized €/t and €/m and delta from buyer target", () => {
  assert.match(baseMigration, /normalized_eur_t/);
  assert.match(baseMigration, /normalized_eur_m/);
  assert.match(baseMigration, /delta_eur_t/);
  assert.match(baseMigration, /comparable_delta_pct/);
  assert.match(comparison, /Target buyer/);
  assert.match(comparison, /Delta target/);
});

test("RFQH5 only ranks a supplier total when the full request is covered", () => {
  assert.match(quantityHardening, /fully_covered_lines/);
  assert.match(quantityHardening, /is_full_line_coverage/);
  assert.match(
    quantityHardening,
    /smb\.fully_covered_lines=smb\.total_lines and smb\.total_lines>0/,
  );
  assert.match(comparison, /Solo offerte 100%/);
  assert.match(comparison, /Migliore offerta completa/);
});

test("RFQH5 converts offered quantity to tonnes before coverage scoring", () => {
  assert.match(quantityHardening, /offered_quantity_mode='tonnes'/);
  assert.match(
    quantityHardening,
    /offered_quantity\*sl\.weight_kg_m\/1000/,
  );
  assert.match(
    quantityHardening,
    /offered_quantity\*sl\.bar_length_m\*sl\.weight_kg_m\/1000/,
  );
  assert.match(quantityHardening, /quantity_coverage_pct/);
  assert.match(quantityHardening, /covered_tonnes/);
  assert.match(comparison, /Parziale/);
});

test("RFQH5 best line price ignores suppliers that cannot cover the whole line", () => {
  assert.match(
    quantityHardening,
    /lqb\.is_full_line_coverage[\s\S]*dense_rank\(\) over/,
  );
  assert.match(
    quantityHardening,
    /where lqb\.response_status='quoted'[\s\S]*lqb\.is_full_line_coverage/,
  );
  assert.match(comparison, /Miglior prezzo/);
});

test("RFQH5 split benchmark uses only fully coverable line offers", () => {
  assert.match(
    quantityHardening,
    /where lq\.response_status='quoted' and lq\.is_full_line_coverage and lq\.line_offer_total_eur is not null/,
  );
  assert.match(baseMigration, /split_benchmark/);
  assert.match(comparison, /Benchmark split/);
  assert.match(comparison, /riferimento analitico, non un award/);
});

test("RFQH5 exposes transparent buyer-side sorting without automatic award", () => {
  assert.match(comparison, /Ordina per/);
  assert.match(comparison, /Copertura/);
  assert.match(comparison, /Totale completo/);
  assert.match(comparison, /Lead time/);
  assert.match(comparison, /regole dichiarate/);
  assert.doesNotMatch(comparison, /auto.?award|assegna automaticamente|supplier_score/i);
});

test("RFQH5 is integrated into the RFQ buyer detail", () => {
  assert.match(buyerPage, /rfqh5_quote_comparison/);
  assert.match(buyerPage, /RfqQuoteComparison/);
  assert.match(buyerPage, />RFQH5</);
});
