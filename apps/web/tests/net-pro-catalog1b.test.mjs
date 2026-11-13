import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const get=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=get("../../../supabase/migrations/20261113104500_net_pro_catalog1b_scoped_access_coverage.sql");
const parser=get("lib/network-pro-coverage.ts");
const ui=get("components/network-pro-catalog.tsx");
const catalogPage=get("app/(italian)/(workspace)/network/pro/page.tsx");
const browsePage=get("app/(italian)/(workspace)/network/pro/explore/page.tsx");
const oldAccess=get("lib/network-access.ts");
const mainDirectory=get("app/(italian)/(workspace)/network/page.tsx");

test("B: catalog access is per-module and country, with Italy-only not European",()=>{
  for(const key of ["producers","distributors","end_users","processors"]){
    assert.match(sql,new RegExp("'"+key+"'"));
  }
  assert.match(sql,/network_pro_/);
  assert.match(sql,/then array\['eu','it'\]/);
  assert.match(sql,/else array\['eu'\]/);
  assert.match(sql,/private\.pa1_3_network_access_allowed_for\(p_organization_id\)/);
  assert.match(sql,/p_country/);
  assert.match(sql,/private\.netpro1b_allowed_for/);
  assert.match(sql,/not private\.netpro1b_allowed_for\(p_organization_id,p_module,v_country\)/);
  assert.match(sql,/errcode='42501'/);
});

test("B: only trusted platform/service can grant or revoke module subscriptions",()=>{
  assert.match(sql,/private\.pa1_3_require_entitlement_authority\(\)/);
  assert.match(sql,/organization_product_entitlement_events/);
  assert.match(sql,/Network PRO idempotency conflict/);
  assert.match(sql,/Cannot revoke ungranted module/);
  assert.match(sql,/p_event_type not in \('granted','revoked'\)/);
  assert.match(sql,/revoke all on function public\.netpro1b_module_event[^;]* from public,anon;/);
  assert.match(sql,/grant execute on function public\.netpro1b_module_event[^;]* to authenticated,service_role;/);
  assert.doesNotMatch(sql,/grant\s+(?:select|insert|update|delete)\s+on\s+public\.organization_product_entitlement_events\s+to\s+authenticated/i);
});

test("B: coverage totals distinguish published multi-role companies and unconfirmed sources",()=>{
  assert.match(sql,/publication_status='published'/);
  assert.match(sql,/r\.status='active'/);
  assert.match(sql,/select distinct p\.country_code,p\.id,r\.canonical_key/);
  assert.match(sql,/published-unclassified/);
  assert.match(sql,/private\.netfast_discovered_records/);
  assert.match(sql,/provisional_modules/);
  assert.match(sql,/jsonb_build_object\('contract','netpro1b-coverage-v1'/);
  assert.match(sql,/No authorized organization for coverage/);
  assert.match(sql,/o\.onboarding_status is distinct from 'suspended'/);
  assert.doesNotMatch(sql,/from public\.commercial_memory|public\.private_customer/i);
});

test("B: coverage parser is fail closed on inconsistent counts and untrusted countries",()=>{
  assert.match(parser,/classified\+unclassified!==published/);
  assert.match(parser,/isEuropean\(countryCode\)/);
  assert.match(parser,/publishedModules\[key\]>published/);
  assert.match(parser,/typeof obj\.legacy_full_network!=="boolean"/);
  assert.match(parser,/getNetworkProScopedDirectory/);
  assert.match(parser,/status:error\.code==="42501"\?"locked":"unavailable"/);
});

test("B: UI counts only source-backed rows and preserves Free/legacy PRO access",()=>{
  assert.match(catalogPage,/getNetworkProCoverage/);
  assert.match(catalogPage,/getNetworkProAccess/);
  assert.match(ui,/data-testid="netpro1b-coverage"/);
  assert.match(ui,/non costituiscono copertura commerciale pronta/);
  assert.match(ui,/netpro1b-country-/);
  assert.match(ui,/access\?\.modules\[module\.key\]/);
  assert.match(browsePage,/getNetworkProScopedDirectory/);
  assert.match(browsePage,/result\.status==="locked"/);
  assert.match(browsePage,/data-testid="netpro1b-scoped-explore"/);
  assert.match(mainDirectory,/getNetworkAccessState/);
  assert.match(oldAccess,/pa1_3_network_access_state/);
  assert.match(sql,/No active membership for this company/);
});
