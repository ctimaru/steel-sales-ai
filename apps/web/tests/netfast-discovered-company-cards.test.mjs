import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../../../supabase/migrations/20261016163000_netfast_provisional_source_view.sql");
const directory=read("../../../supabase/migrations/20261016163100_netfast_free_directory.sql");
const profile=read("../../../supabase/migrations/20261016163200_netfast_free_profile.sql");
const model=read("../lib/network-free.ts");
const component=read("../components/free-network-directory.tsx");
const detail=read("../components/free-network-profile.tsx");
test("NETFAST only exposes source-governed candidates and research leads",()=>{
 assert.match(source,/review_status='pending_review'/);
 assert.match(source,/governance_status='approved_company_data'/);
 assert.match(source,/personal_data_detected=false/);
 assert.match(source,/match_company_id is null/);
 assert.match(source,/review_status='rejected'/);
 assert.match(source,/network_core_target_leads/);
 assert.match(source,/partition by a.domain/);
 assert.doesNotMatch(source+directory+profile,/insert into public.network_companies/);
});
test("NETFAST Free gate has no privileged public reader",()=>{
 assert.match(directory,/private.netux11_require_active_company/);
 assert.match(profile,/private.netux11_require_active_company/);
 assert.match(directory,/language sql stable security invoker/);
 assert.match(profile,/language sql stable security invoker/);
});
test("NETFAST unconfirmed cards and profile route are unmistakable",()=>{
 assert.match(model,/netfast_free_directory/);
 assert.match(model,/netfast_free_profile/);
 assert.match(component,/company.discovery_status==="unconfirmed"/);
 assert.match(detail,/Scoperta dal Network · Da confermare/);
 assert.match(detail,/company-data/);
});
