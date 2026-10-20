import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const migration=readFileSync(new URL("../../../supabase/migrations/20261020235000_netit_identity2d3_owner_resolution.sql",import.meta.url),"utf8");
const sqlTests=readFileSync(new URL("../../../supabase/tests/netit_identity2d3_owner_resolution.sql",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/(italian)/(workspace)/network/[id]/suggest-correction/page.tsx",import.meta.url),"utf8");
const actions=readFileSync(new URL("../app/(italian)/(workspace)/network/[id]/suggest-correction/actions.ts",import.meta.url),"utf8");
const reader=readFileSync(new URL("../lib/netit-identity-resolution.ts",import.meta.url),"utf8");
const hp13=readFileSync(new URL("../../../supabase/tests/hp13_permissions_tenant_isolation.sql",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../../../.github/workflows/p0-required-gate.yml",import.meta.url),"utf8");

test("IDENTITY2D.3 immutable resolutions cannot merge, publish or create ownership",()=>{
 assert.match(migration,/create table private\.netit_identity_correction_resolutions/);
 assert.match(migration,/decision_key in \('owner_supported','owner_disputed','owner_withdrawn'\)/);
 assert.match(migration,/netit_identity2d3_request_history/);
 assert.match(migration,/left join lateral/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/interval '24 hours'/);
 assert.match(migration,/request_id uuid not null references private\.netit_identity_correction_requests\(id\)/);
 assert.match(migration,/default false check \(not legal_identity_verified\)/);
 assert.match(migration,/default false check \(not automatic_publication\)/);
 assert.match(migration,/default false check \(not merge_performed\)/);
 assert.match(migration,/before update or delete on private\.netit_identity_correction_resolutions/);
 assert.doesNotMatch(migration,/\bupdate\s+(public\.network_companies|private\.netfast_discovered_records|public\.network_company_claims)/i);
 assert.doesNotMatch(migration,/\binsert\s+into\s+public\.network_company_claims/i);
 assert.match(migration,/'claim_created',false/);
 assert.match(migration,/'legal_identity_verified',false/);
 assert.match(migration,/'published',false/);
 assert.match(sqlTests,/netit_identity2d3_resolution_immutable/);
});

test("IDENTITY2D.3 owner resolution requires one-to-one Italian domain AND approved claim",()=>{
 assert.match(migration,/private\.netit_identity2d3_owner_company/);
 assert.match(migration,/private\.hp4_normalize_domain/);
 assert.match(migration,/from private\.netfast_discovered_records d[\s\S]*?<>\s*1 then return null/);
 assert.match(migration,/from public\.network_companies c[\s\S]*?<>\s*1 then return null/);
 assert.match(migration,/c\.country_code='IT'/);
 assert.match(migration,/l\.link_status='active'/);
 assert.match(migration,/cl\.status='approved'/);
 assert.match(migration,/private\.netux11_require_active_company\(p_organization_id\)/);
 assert.match(migration,/m\.user_id=v_actor/);
 assert.match(migration,/m\.role='admin'/);
 assert.match(migration,/email_confirmed_at is not null/);
 assert.match(migration,/p_decision not in \('owner_supported','owner_disputed','owner_withdrawn'\)/);
});

test("IDENTITY2D.3 query and writer guard private per-company data",()=>{
 assert.match(migration,/r\.organization_id=p_organization_id or v_owner_company is not null/);
 assert.match(migration,/'can_attest',v_owner_company is not null and decision_key is null/);
 assert.match(migration,/revoke all on function public\.netit_identity2d3_correction_queue/);
 assert.match(migration,/revoke all on function public\.netit_identity2d3_owner_attest/);
 assert.match(migration,/revoke all on function private\.netit_identity2d3_owner_company/);
 assert.match(sqlTests,/set local role authenticated/);
 assert.match(sqlTests,/has_table_privilege\('authenticated','private\.netit_identity_correction_resolutions'/);
 assert.match(hp13,/'netit_identity2d3_correction_queue'/);
 assert.match(hp13,/'netit_identity2d3_owner_attest'/);
 assert.match(workflow,/netit_identity2d3_owner_resolution\.sql/);
});

test("IDENTITY2D.3 UI shows own safe-source status and separately guarded claim bridge",()=>{
 assert.match(page,/getItalianCorrectionQueue\(context\.organizationId,id\)/);
 assert.match(page,/queue\.claim_target_company_id/);
 assert.match(page,/\/claim/);
 assert.match(page,/\/register\?company=/);
 assert.match(page,/queue\?\.owner_attestation_eligible/);
 assert.match(page,/item\.can_attest\?<form action=\{attestItalianIdentityCorrection\}/);
 assert.match(page,/safeNetworkWebsiteUrl\(item\.source_url\)/);
 assert.match(page,/ui-action ui-action-secondary/);
 assert.match(page,/nessuna modifica automatica|Nessuna modifica automatica/);
 assert.match(actions,/export async function attestItalianIdentityCorrection/);
 assert.match(actions,/const context=await requireWorkspaceAdmin\(\)/);
 assert.match(actions,/p_organization_id:context\.organizationId/);
 assert.match(actions,/netit_identity2d3_owner_attest/);
 assert.match(actions,/receipt\.published!==false/);
 assert.match(reader,/value\.changes_published!==0/);
 assert.match(reader,/value\.legal_identity_verifications!==0/);
 assert.match(reader,/value\.new_claims!==0/);
});
