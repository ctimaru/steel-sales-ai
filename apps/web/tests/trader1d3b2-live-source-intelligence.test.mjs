import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p,import.meta.url),"utf8");
const sql = read("../../../supabase/migrations/20261020233000_trader1d3b2_live_source_intelligence.sql");
const security = read("../../../supabase/tests/trader1d3b2_live_source_intelligence.sql");
const hp13 = read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
const page = read("../app/(italian)/(platform)/platform/company-discovery/trader-verification/page.tsx");

test("TRADER1D.3B.2 takes live official source URLs, never caller-selected HTTP targets", () => {
  assert.match(sql,/FROM private\.netdata1eu_trader_research r/);
  assert.match(sql,/trader1d3b2_source_batch/);
  assert.match(sql,/p_limit NOT BETWEEN 1 AND 5/);
  assert.match(sql,/v_url<>v_expected/);
  assert.match(sql,/ON CONFLICT \(research_id,source_kind,observation_date\) DO NOTHING/);
  assert.doesNotMatch(sql,/UPDATE\s+private\.netdata1eu_trader_research\s+SET\s+source_rights/i);
  assert.doesNotMatch(sql,/\bUPDATE\s+(?:public\.)?network_companies\b|\bINSERT\s+INTO\s+public\.network_companies/i);
  assert.doesNotMatch(sql,/\bUPDATE\s+private\.netdata1eu_trader_research\b/i);
});

test("TRADER1D.3B.2 keeps immutable browser-isolated ledger and owner health view", () => {
  assert.match(sql,/ALTER TABLE private\.trader1d3b2_source_observations ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/BEFORE UPDATE OR DELETE ON private\.trader1d3b2_source_observations/);
  assert.match(sql,/current_user <> 'service_role'/);
  assert.match(sql,/FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.trader1d3b2_source_batch/);
  assert.match(sql,/TO service_role/);
  assert.match(sql,/platform_user_roles pur/);
  assert.match(sql,/pur\.role='platform_superadmin'/);
  assert.match(sql,/pur\.status='active'/);
  assert.match(sql,/TO authenticated/);
  assert.match(hp13,/'trader1d3b2_owner_health'/);
  assert.match(security,/Same-day observation replay was not idempotent/);
  assert.match(security,/Forged URL was accepted/);
});

test("TRADER1D.3B.2 owner UI fails softly before activation without false success", () => {
  assert.match(page,/requirePlatformSuperadmin\(\)/);
  assert.match(page,/supabase\.rpc\("trader1d3b2_owner_health"/);
  assert.match(page,/contract === "trader1d3b2-owner-health-v1"/);
  assert.match(page,/Backend live non attivo/);
  assert.match(page,/Nessuna osservazione ancora registrata/);
  assert.match(page,/dimostra identità legale/);
  assert.doesNotMatch(page,/recordTraderReview/);
});
