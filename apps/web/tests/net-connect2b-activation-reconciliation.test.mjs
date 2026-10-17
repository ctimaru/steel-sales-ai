import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const migration=read("../../../supabase/migrations/20261017173000_netconnect2b_activation_reconciliation.sql");
const api=read("../lib/network-activation-overview.ts");
const route=read("../app/(italian)/(platform)/platform/network-activation/page.tsx");
const registration=read("../app/(italian)/(platform)/platform/registrations/page.tsx");
const routes=read("../lib/routes.ts");
const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
const gate=read("../../../.github/workflows/p0-required-gate.yml");

test("NET-CONNECT2B: activation dashboard displays real distinct database-backed stage counts",()=>{
 for(const k of ["published","provisional_visible","registrations_activated",
  "claims_pending","claims_approved","companies_linked_and_claim_approved"]){
  assert.ok(migration.includes("'"+k+"'"),"Missing counted source: "+k);
  assert.ok(route.includes(k),"Missing UI stage: "+k);
 }
 assert.match(migration,/public\.organization_network_company_links/);
 assert.match(migration,/cl\.status='approved'/);
 assert.match(migration,/m\.status='active'/);
 assert.match(route,/conteggi verificati nel database/);
 assert.doesNotMatch(route,/fake_count|Math\.random/);
});

test("NET-CONNECT2B: owner-only RPC restricts access inside DB, not just frontend",()=>{
 assert.match(route,/requirePlatformPermission\("registrations.read"\)/);
 assert.match(route,/!access\?\.is_platform_owner/);
 assert.match(migration,/private\.is_platform_superadmin\(\)/);
 assert.match(migration,/revoke all on function public\.netconnect2b_activation_overview\(\) from public,anon/);
 assert.match(migration,/revoke all on private\.netconnect2b_canonical_evidence from public,anon,authenticated/);
 assert.match(migration,/alter table private\.netconnect2b_canonical_evidence enable row level security/);
 assert.match(hp13,/'netconnect2b_activation_overview'/);
 assert.match(gate,/netconnect2b_activation_reconciliation\.sql/);
 assert.match(api,/netconnect2b_activation_overview/);
});

test("NET-CONNECT2B: reconcile evidence only on domain, exact name and canonical uniqueness",()=>{
 assert.match(migration,/private\.netconnect2b_legal_key\(c\.legal_name\)=private\.netconnect2b_legal_key\(s\.company_name\)/);
 assert.match(migration,/private\.netconnect2b_domain\(c\.website_domain\)=private\.netconnect2b_domain\(s\.domain\)/);
 assert.match(migration,/count\(\*\) from public\.network_companies other/);
 assert.match(migration,/create trigger netconnect2b_capture_published_identity/);
 assert.match(migration,/on conflict do nothing/);
 assert.doesNotMatch(migration,/insert into public\.network_company_claims|update public\.network_companies|insert into public\.organization_network_company_links/);
});

test("NET-CONNECT2B: suggested registration matches never automatically claim a provisional company",()=>{
 assert.match(migration,/private\.netfast_discovered_records/);
 assert.match(migration,/a\.email_verified_at is not null/);
 assert.match(migration,/same_domain_applications=1 and same_domain_discoveries=1/);
 assert.match(migration,/'strong_evidence'/);
 assert.match(migration,/'ambiguous_review'/);
 assert.match(route,/non un nuovo claim né un trasferimento di controllo/);
 assert.match(route,/domini condivisi, nomi diversi o email non confermate/);
 assert.match(route,/Nessuna domanda associabile/);
});

test("NET-CONNECT2B: platform navigation exposes owner activation insight",()=>{
 assert.match(registration,/access\?\.is_platform_owner/);
 assert.match(registration,/appRoutes\.platform\.networkActivation/);
 assert.match(routes,/networkActivation: "\/platform\/network-activation"/);
});
