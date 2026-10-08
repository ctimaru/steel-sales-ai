import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261007085945_rfqh12_procurement_intelligence.sql", import.meta.url),
  "utf8",
);
const hardening = fs.readFileSync(
  new URL("../../../supabase/migrations/20261007090704_rfqh12_profile_uuid_aggregate_fix.sql", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/intelligence/page.tsx", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const ia = fs.readFileSync(
  new URL("../lib/workspace-information-architecture.ts", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const marketplaceHome = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/page.tsx", import.meta.url),
  "utf8",
);

test("RFQH12 exposes an authenticated owner-scoped procurement intelligence RPC", () => {
  assert.match(migration, /rfqh12_procurement_intelligence/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /r\.owner_user_id=v_user_id/);
  assert.match(migration, /revoke all on function public\.rfqh12_procurement_intelligence/);
  assert.match(migration, /grant execute on function public\.rfqh12_procurement_intelligence\(integer\)\s+to authenticated/);
});

test("RFQH12 hardening avoids unsupported UUID aggregates in the executable contract", () => {
  assert.match(hardening, /array_agg\(sr\.profile_id order by sr\.profile_id::text\)/);
  assert.doesNotMatch(hardening, /max\(sr\.profile_id\)/);
});

test("RFQH12 calculates saving vs target from immutable award snapshots", () => {
  assert.match(migration, /buyer_rfq_awards/);
  assert.match(migration, /sum\(a\.target_total_eur\)/);
  assert.match(migration, /sum\(a\.savings_eur\)/);
  assert.match(migration, /'savings_pct'/);
  assert.match(page, /Savings vs Target/);
});

test("RFQH12 calculates quote coverage response and lead-time metrics independently", () => {
  assert.match(migration, /quote_coverage_pct/);
  assert.match(migration, /response_rate_pct/);
  assert.match(migration, /avg_response_hours/);
  assert.match(migration, /avg_lead_time_days/);
  assert.match(page, /Metriche separate, senza score sintetico/);
  assert.match(page, /Nessun punteggio unico o ranking opaco/);
});

test("RFQH12 provides transparent supplier performance with CRM drill-down", () => {
  assert.match(migration, /supplier_performance/);
  assert.match(migration, /award_rate_pct/);
  assert.match(migration, /po_confirmation_rate_pct/);
  assert.match(page, /appRoutes\.marketplace\.supplier/);
  assert.match(page, /Supplier performance/);
});

test("RFQH12 derives article price intelligence from latest comparable supplier quotes", () => {
  assert.match(migration, /price_samples_base/);
  assert.match(migration, /article_rollup/);
  assert.match(migration, /latest_eur_t/);
  assert.match(migration, /previous_eur_t/);
  assert.match(migration, /change_pct/);
  assert.match(page, /Storico prezzi per articolo/);
});

test("RFQH12 keeps a source-level price history and award drill-down", () => {
  assert.match(migration, /'price_history'/);
  assert.match(migration, /'awards'/);
  assert.match(page, /Ultime quote ricevute/);
  assert.match(page, /appRoutes\.marketplace\.rfqCampaign/);
});

test("RFQH12 stays integrated while PF4 keeps Marketplace navigation compact", () => {
  assert.match(routes, /procurementIntelligence: "\/marketplace\/intelligence"/);
  assert.match(ia, /"marketplace:intelligence"/);
  assert.match(marketplaceHome, /appRoutes\.marketplace\.procurementIntelligence/);
  assert.match(marketplaceHome, /Intelligence acquisti/);
  const marketplaceNav = shell.slice(shell.indexOf("const marketplaceNav:"), shell.indexOf("const knowledgeNav:"));
  assert.doesNotMatch(marketplaceNav, /label: "Intelligence"/);
  assert.match(shell, /label: "Intelligence".*contextKey: "rfq:intelligence"/);
});
