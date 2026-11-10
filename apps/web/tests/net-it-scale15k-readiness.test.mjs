import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261110124000_net_it_scale15k_readiness_console.sql");
const page = read("../app/(italian)/(platform)/platform/company-discovery/scale15k/page.tsx");
const discovery = read("../app/(italian)/(platform)/platform/company-discovery/page.tsx");
const ia = read("../lib/platform-ia-contract.ts");

test("Italian 15k dashboard counts canonical published only, without assuming private seed uniqueness", () => {
  assert.match(sql, /'goal',15000/);
  assert.match(sql, /nc\.country_code='IT' AND nc\.publication_status='published'/);
  assert.match(sql, /nc\.archived_at IS NULL/);
  assert.match(sql, /'private_seed_unlinked_domains'/);
  assert.match(sql, /count\(DISTINCT lower\(trim\(s\.canonical_domain\)\)\)/);
  assert.match(sql, /public\.network_company_discovery_candidates dc/);
  assert.match(sql, /public\.network_companies nc/);
  assert.match(sql, /'published_missing_role'/);
  assert.match(page, /Obiettivo 15\.000 aziende/);
  assert.match(page, /canonical_published/);
  assert.match(page, /private_seed_unlinked_domains/);
  assert.match(page, /published_missing_role/);
  assert.doesNotMatch(page, /278\s*\/\s*15\.000|14\.722/);
});

test("Read-only growth queue is bounded to 250, identifies cross-source duplicates and genuine reasons", () => {
  assert.match(sql, /p_limit integer DEFAULT 50/);
  assert.match(sql, /p_limit NOT BETWEEN 1 AND 250/);
  assert.match(sql, /p_offset NOT BETWEEN 0 AND 15000/);
  assert.match(sql, /row_number\(\) OVER/);
  assert.match(sql, /PARTITION BY b\.normal_domain/);
  assert.match(sql, /r\.same_domain_rank>1/);
  assert.match(sql, /r\.catalog_collision/);
  assert.match(sql, /r\.source_governance<>'approved'/);
  assert.match(sql, /private\.net_pipeline1b2_eligibility\(c\.id\)/);
  assert.match(sql, /r\.candidate_governance<>'approved_company_data'/);
  assert.match(sql, /WHEN r\.eligibility_reason='eligible_minimal_preview'/);
  for(const lane of ["ready","review_source","review_company","duplicate","hold"]){
    assert.ok(sql.includes("'" + lane + "'"), "missing queue lane " + lane);
  }
  assert.doesNotMatch(sql, /(?:INSERT\s+INTO|UPDATE\s+public\.network_companies|DELETE\s+FROM)/i);
  assert.doesNotMatch(page, /server.action|publish_one|publish_batch|enable.*publisher/);
});

test("Platform-only confidential funnel: private definer, public invoker, anon denied", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.net_it_scale15k_readiness_impl/);
  assert.match(sql, /LANGUAGE plpgsql STABLE SECURITY DEFINER/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.net_it_scale15k_readiness/);
  assert.match(sql, /LANGUAGE sql STABLE SECURITY INVOKER/);
  assert.match(sql, /auth\.uid\(\) IS NULL/);
  assert.match(sql, /require_platform_permission\('discovery\.read'\)/);
  assert.match(sql, /require_platform_permission\('discovery\.governance_review'\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.net_it_scale15k_readiness/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.net_it_scale15k_readiness_impl/);
  assert.match(page, /requirePlatformPermission\("discovery\.governance_review"\)/);
  assert.match(page, /supabase\.rpc\("net_it_scale15k_readiness"/);
});

test("Growth interface filters queue without mutating, with compact entry point and route inventory", () => {
  assert.match(page, /aria-label="Network Italia/);
  assert.match(page, /aria-label="Filtra aziende per stato"/);
  assert.match(page, /\[50, 100, 250\]/);
  assert.match(page, /role="progressbar"/);
  assert.match(page, /Il filtro non cambia né approva alcun dato/);
  assert.match(page, /safeHttps\(item\.source_url\)/);
  assert.match(discovery, /href="\/platform\/company-discovery\/scale15k"/);
  assert.match(ia, /\{ path: "\/platform\/company-discovery\/scale15k", module: "discovery" \}/);
});
