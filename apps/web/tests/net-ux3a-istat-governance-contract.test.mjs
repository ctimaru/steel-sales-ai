import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=(p)=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const migration=read("../../../supabase/migrations/20261016160000_netux3a_istat_import_atomic.sql");
const guard=read("../../../supabase/migrations/20261016162000_netux3a_province_token_hardening.sql");
const ui=read("../app/(platform)/platform/company-discovery/geo-review/municipalities/page.tsx");
const actions=read("../app/(platform)/platform/company-discovery/geo-review/municipalities/actions.ts");
const registry=read("../lib/platform-ia-contract.ts");

test("NET-UX3A ISTAT import is service-role only, staged, atomic and non-destructive",()=>{
 assert.match(migration,/create table if not exists public\.network_it_istat_import_staging/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/v_rows<>7894 or v_regions<>20/);
 assert.match(migration,/is_current=false/);
 assert.match(migration,/on conflict \(istat_code\) do update/);
 assert.match(migration,/revoke all on function public\.netux3a_activate_istat_import\(uuid\) from public,anon,authenticated/);
 assert.match(migration,/grant execute on function public\.netux3a_activate_istat_import\(uuid\) to service_role/);
 assert.doesNotMatch(migration,/delete from public\.network_it_municipalities|network_company_discovery_candidates|network_inquiries/);
});

test("NET-UX3A requires official company evidence and independent permission-based review",()=>{
 assert.match(guard,/p_evidence_snippet !~\*/);
 assert.match(guard,/\[\^\[:alpha:\]\]/);
 assert.doesNotMatch(guard,/strpos\(upper\(p_evidence_snippet\),upper\(btrim\(p_province_code\)\)\)/);
 assert.match(migration,/private\.require_platform_permission\('discovery.enrich'\)/);
 assert.match(migration,/private\.require_platform_permission\('discovery.governance_review'\)/);
 assert.match(migration,/private\.require_platform_permission\('discovery.publish'\)/);
 assert.match(migration,/status='pending_review'/);
 assert.match(migration,/facility_changed',false/);
 assert.match(migration,/company_verified',false/);
 assert.match(actions,/requirePlatformPermission\("discovery.enrich"\)/);
 assert.match(actions,/requirePlatformPermission\("discovery.publish"\)/);
});

test("NET-UX3A gated Platform worklist preserves source and avoids guessed geographic data",()=>{
 assert.match(ui,/reference_count === 7894/);
 assert.match(ui,/stageMunicipalityMatch/);
 assert.match(ui,/decideMunicipalityMatch/);
 assert.match(ui,/Riferimento ISTAT non ancora importato o incompleto/);
 assert.match(ui,/Fonte:|ISTAT – codici territoriali/);
 assert.match(registry,/\/platform\/company-discovery\/geo-review\/municipalities/);
 assert.doesNotMatch(ui,/latitude|longitude|automatic-geocode|autopublish/i);
});
