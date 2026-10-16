import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const schema=read("../../../supabase/migrations/20261016213000_netcov2b_domain_permissions.sql");
const activation=read("../../../supabase/migrations/20261016213100_netcov2b_source_activation.sql");
const preparation=read("../../../supabase/migrations/20261016213200_netcov2b_operator_run_preparation.sql");
const linkage=read("../../../supabase/migrations/20261016213300_netcov2b_atomic_link_and_candidate_gate.sql");
const isolation=read("../../../supabase/migrations/20261016213400_netcov2b_generic_worker_isolation.sql");
const ui=read("../app/(platform)/platform/company-discovery/sources/page.tsx");
const actions=read("../app/(platform)/platform/company-discovery/sources/actions.ts");
test("NET-COV2B requires per-domain explicit permission, independent rights-approved source",()=>{
 assert.match(schema,/netcov2b_record_permission/);
 assert.match(schema,/source_type<>'company_submission'/);
 assert.match(schema,/t.evidence_url<>u/);
 assert.match(activation,/consented_domains/);
});
test("NET-COV2B is manual, private and never auto publishes",()=>{
 assert.match(preparation,/queued_unreviewed/);
 assert.match(linkage,/public.netcov2b_stage_candidate/);
 assert.match(isolation,/netcov2b_source_activation_guard/);
 assert.match(isolation,/source_type<>'company_submission'/);
 assert.doesNotMatch(schema+activation+preparation+linkage+isolation,/insert into public.network_companies/);
});
test("NET-COV2B Platform wiring requires human attestation",()=>{
 assert.match(ui,/recordFirstPartyPermission/);
 assert.match(ui,/activateConsentedSource/);
 assert.match(ui,/prepareFirstPartyRun/);
 assert.match(ui,/linkApprovedFirstPartyRun/);
 assert.match(actions,/netcov2b_record_permission/);
 assert.match(actions,/requirePlatformPermission\("discovery.governance_review"\)/);
});
