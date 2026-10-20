import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const migration=readFileSync(new URL("../../../supabase/migrations/20261020234000_netit_identity2d2_correction_intake.sql",import.meta.url),"utf8");
const sqlTest=readFileSync(new URL("../../../supabase/tests/netit_identity2d2_correction_intake.sql",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/(italian)/(workspace)/network/[id]/suggest-correction/page.tsx",import.meta.url),"utf8");
const action=readFileSync(new URL("../app/(italian)/(workspace)/network/[id]/suggest-correction/actions.ts",import.meta.url),"utf8");
const profile=readFileSync(new URL("../components/free-network-profile.tsx",import.meta.url),"utf8");
const hp13=readFileSync(new URL("../../../supabase/tests/hp13_permissions_tenant_isolation.sql",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../../../.github/workflows/p0-required-gate.yml",import.meta.url),"utf8");

test("Identity2D.2 never promotes corrections or bypasses corporate claim",()=>{
 assert.match(migration,/status text not null default 'submitted' check \(status='submitted'\)/);
 assert.match(migration,/claim_granted boolean not null default false check \(not claim_granted\)/);
 assert.match(migration,/legal_identity_verified boolean not null default false check \(not legal_identity_verified\)/);
 assert.match(migration,/published boolean not null default false check \(not published\)/);
 assert.match(migration,/rights_assessed text not null default 'not_assessed'/);
 assert.match(migration,/before update or delete on private.netit_identity_correction_requests/);
 assert.match(migration,/before update or delete on private.netit_identity_correction_events/);
 assert.doesNotMatch(migration,/update public\.network_companies|update private\.netfast_discovered_records|insert into public\.network_company_claims/i);
});

test("Identity2D.2 validates JWT actor, admin membership, email, source and rate limits at the DB",()=>{
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/auth\.jwt\(\)/);
 assert.match(migration,/m\.user_id=v_actor and m\.organization_id=p_organization_id/);
 assert.match(migration,/m\.status='active' and m\.role='admin'/);
 assert.match(migration,/private\.netux11_require_active_company\(p_organization_id\)/);
 assert.match(migration,/email_confirmed_at/);
 assert.match(migration,/v_url !~ '\^https:/);
 assert.match(migration,/v_match :=/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/interval '24 hours'/);
 assert.match(migration,/interval '60 seconds'/);
 assert.match(migration,/create unique index netit_identity2d2_dedup/);
 assert.match(migration,/revoke all on function public\.netit_identity2d2_submit_correction/);
 assert.match(migration,/grant execute on function public\.netit_identity2d2_submit_correction/);
 assert.match(sqlTest,/set local role authenticated;/);
 assert.match(sqlTest,/has_table_privilege\('anon'/);
 assert.match(hp13,/'netit_identity2d2_submit_correction'/);
 assert.match(workflow,/netit_identity2d2_correction_intake\.sql/);
});

test("Identity2D.2 UI is discovered-only with no claim or legal publication",()=>{
 assert.match(route,/requireWorkspaceAdmin/);
 assert.match(route,/profile\.company\.discovery_status!=="unconfirmed"/);
 assert.match(route,/profile\.company\.country_code!=="IT"/);
 assert.match(route,/submitItalianIdentityCorrection/);
 assert.match(route,/name="representation_basis"/);
 assert.match(route,/dichiara|Dichiaro/);
 assert.match(route,/type="url"/);
 assert.match(route,/type="checkbox"/);
 assert.match(route,/ui-action-primary/);
 assert.match(profile,/isWorkspaceAdmin \? <Link href=\{"\/network\/"\+companyId\+"\/suggest-correction"\}/);
 assert.match(action,/requireWorkspaceAdmin\(\)/);
 assert.match(action,/p_organization_id:context\.organizationId/);
 assert.match(action,/netit_identity2d2_submit_correction/);
 assert.doesNotMatch(action,/organization_id"\)/);
 assert.doesNotMatch(action,/service_role|NEXT_PUBLIC_SUPABASE_SECRET/i);
});
