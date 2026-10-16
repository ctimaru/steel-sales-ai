import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261016130000_netux3_governed_geo_enrichment.sql");
const page = read("../app/(platform)/platform/company-discovery/geo-review/page.tsx");
const actions = read("../app/(platform)/platform/company-discovery/geo-review/actions.ts");
const map = read("../components/italy-region-map.tsx");

test("NET-UX3 identifies location gaps only among published, unarchived Italian companies", () => {
  assert.match(sql, /create or replace function public\.netux3_geographic_backlog/);
  assert.match(sql, /c\.publication_status='published' and c\.archived_at is null and c\.country_code='IT'/);
  assert.match(sql, /f\.publication_status='published' and f\.archived_at is null/);
  assert.match(sql, /'missing_region'/);
  assert.match(sql, /network_it_municipalities/);
  assert.match(page, /backlog\.missing_region/);
});

test("NET-UX3 official-source staging is never publication and requires platform enrichment", () => {
  assert.match(sql, /create or replace function public\.netux3_stage_official_geo/);
  assert.match(sql, /private\.require_platform_permission\('discovery.enrich'\)/);
  assert.match(sql, /Evidence source must match the published company website domain/);
  assert.match(sql, /strpos\(lower\(p_evidence_snippet\),lower\(btrim\(p_city\)\)\)/);
  assert.match(sql, /'pending_review'/);
  assert.match(sql, /'facility_published',false/);
  assert.match(page, /stageOfficialGeoEvidence/);
  assert.match(page, /In,?[vV]ia alla revisione|Invia alla revisione/);
  assert.match(page, /ITALY_REGION_PATHS/);
  assert.match(actions, /await requirePlatformPermission\("discovery.enrich"\)/);
});

test("NET-UX3 publication requires a prior human-reviewed evidence and second approval", () => {
  assert.match(sql, /create or replace function public\.netux3_publish_reviewed_geo/);
  assert.match(sql, /private\.require_platform_permission\('discovery.publish'\)/);
  assert.match(sql, /private\.require_platform_permission\('discovery.governance_review'\)/);
  assert.match(sql, /v.status<>'approved_for_facility_review'/);
  assert.match(sql, /v.reviewed_by is null or v.reviewed_at is null/);
  assert.match(sql, /network_it_geo_publication_ledger/);
  assert.match(sql, /insert into public\.network_data_assertions/);
  assert.match(sql, /'published','unverified'/);
  assert.match(page, /publishReviewedGeoEvidence/);
  assert.match(actions, /netux3_publish_reviewed_geo/);
  assert.match(actions, /revalidatePath\("\/network"\)/);
});

test("NET-UX3 does not leak privileged data or bypass network protections", () => {
  assert.match(sql, /alter table public\.network_it_geo_publication_ledger enable row level security/);
  assert.match(sql, /revoke all on public\.network_it_geo_publication_ledger from public,anon,authenticated/);
  assert.match(sql, /revoke all on function public\.netux3_stage_official_geo/);
  assert.doesNotMatch(sql, /drop policy|alter policy|disable row level security|network_company_discovery_candidates|commercial_memory|service_role_key/i);
  assert.match(map, /regionCoverageCount/);
  assert.match(page, /Nessuna sede pubblicata|non pubblica|non alimentano la mappa/i);
  assert.match(page, /stat[o] non verificato|non verificato/i);
});

test("NET-UX3 permissions are explicit on every platform mutation route", () => {
  for (const key of ['discovery.read','discovery.enrich','discovery.publish','discovery.governance_review']) {
    assert.match(sql, new RegExp("private\\.require_platform_permission\\('"+key.replace(".","\\.")+"'\\)"));
  }
  assert.match(actions, /await requirePlatformPermission\("discovery.publish"\)/);
  assert.match(actions, /await requirePlatformPermission\("discovery.governance_review"\)/);
});
