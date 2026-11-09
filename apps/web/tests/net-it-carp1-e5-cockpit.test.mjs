import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/carpenterie/page.tsx",import.meta.url),"utf8");
const parent=readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/page.tsx",import.meta.url),"utf8");
const bridge=readFileSync(new URL("../../../supabase/migrations/20261108180241_net_it_carp1_e4_private_growth100_bridge.sql",import.meta.url),"utf8");
const access=readFileSync(new URL("../../../supabase/migrations/20261108183857_net_it_carp1_e5_admin_cockpit_reader.sql",import.meta.url),"utf8");
const capabilities=readFileSync(new URL("../../../supabase/migrations/20261108184239_net_it_carp1_e5_cockpit_capability_evidence.sql",import.meta.url),"utf8");
const aliasMigration=readFileSync(new URL("../../../supabase/migrations/20261109082733_net_it_carp1_e7_alias_links_admin_status.sql",import.meta.url),"utf8");
const unified=readFileSync(new URL("../../../supabase/migrations/20261109122600_net_it_carp1_e8c_unified_admin_snapshot.sql",import.meta.url),"utf8");

test("Growth100 cockpit is compact, read-only, source-linked, and restricted to Platform superadmin",()=>{
 assert.match(page,/requirePlatformSuperadmin\(\)/);
 assert.match(page,/netit_carp1_e8_admin_snapshot/);
 assert.match(page,/Tutte coorti/);
 assert.match(page,/provinceFrom/);
 assert.match(page,/cohortFrom/);
 assert.match(page,/research_area_to_verify/);
 assert.match(page,/E8C/);
 assert.match(page,/safeNetworkWebsiteUrl\(url\)/);
 assert.match(page,/observed_capabilities/);
 assert.match(page,/company_source_url/);
 assert.match(page,/contact_source_url/);
 assert.match(page,/name_reconciliation_needed/);
 assert.match(page,/domain_alias_linked/);
 assert.match(page,/snapshot\.alias_linked/);
 assert.match(page,/vat_identity_review/);
 assert.match(page,/Candidatura principale/);
 assert.match(page,/research_seed_missing/);
 assert.match(page,/needs_contact/);
 assert.match(page,/publications_performed === 0/);
 assert.match(parent,/company-discovery\/carpenterie/);
 assert.doesNotMatch(page,/\.from\("network_company_discovery_candidates"\)/);
 assert.doesNotMatch(page,/published_count|publishCompany|approveCompany|mergeCompany/);
});

test("Growth100 database reader guards private contact data and never changes publication state",()=>{
 assert.match(bridge,/WITH \(security_invoker=true\)/i);
 assert.match(bridge,/REVOKE ALL ON private\.netit_carp1_growth100_bridge FROM PUBLIC,anon,authenticated/i);
 assert.match(access,/SECURITY DEFINER/);
 assert.match(access,/SECURITY INVOKER/);
 assert.match(access,/auth\.uid\(\)/);
 for(const permission of ["discovery.read","discovery.governance_review","network.privacy_governance_review"]){
  assert.ok(access.includes("require_platform_permission('"+permission+"')"));
 }
 assert.match(access,/REVOKE ALL ON FUNCTION public\.netit_carp1_e5_admin_snapshot\(text,text,integer,integer\) FROM PUBLIC,anon,authenticated/i);
 assert.match(access,/GRANT EXECUTE ON FUNCTION public\.netit_carp1_e5_admin_snapshot\(text,text,integer,integer\) TO authenticated/i);
 assert.match(access,/LIMIT p_limit OFFSET p_offset/);
 assert.match(access,/publication[s]?_performed/);
 assert.match(capabilities,/observed_capabilities/);
 assert.match(aliasMigration,/identity_link_e7/);
 assert.match(aliasMigration,/exact_domain_alias_linked/);
 assert.match(aliasMigration,/domain_alias_linked/);
 assert.match(aliasMigration,/vat_identity_review/);
 assert.match(unified,/netit_carp1_e8_admin_snapshot_impl/);
 assert.match(unified,/netit_carp1_e8_admin_snapshot/);
 assert.match(unified,/auth\.uid\(\)/);
 for(const permission of ["discovery.read","discovery.governance_review","network.privacy_governance_review"]){
   assert.ok(unified.includes("require_platform_permission('"+permission+"')"));
 }
 assert.match(unified,/SECURITY DEFINER/);
 assert.match(unified,/SECURITY INVOKER/);
 assert.match(unified,/REVOKE ALL ON FUNCTION public\.netit_carp1_e8_admin_snapshot/);
 assert.match(unified,/GRANT EXECUTE ON FUNCTION public\.netit_carp1_e8_admin_snapshot/);
 assert.match(unified,/LIMIT p_limit OFFSET p_offset/);
 assert.match(unified,/publications_performed/);
 assert.doesNotMatch(unified,/(UPDATE|DELETE FROM|INSERT INTO)\s+public\.network_company_discovery_candidates/i);
 assert.match(aliasMigration,/WITH \(security_invoker=true\)/i);
 assert.doesNotMatch(access,/(insert\s+into|update\s+public\.network_companies|delete\s+from)\s+public\.network_companies/i);
});
