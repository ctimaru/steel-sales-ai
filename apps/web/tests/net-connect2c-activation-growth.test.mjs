import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const migration=read("../../../supabase/migrations/20261017180000_netconnect2c_activation_growth.sql");
const helper=read("../lib/network-growth-overview.ts");
const page=read("../app/(italian)/(platform)/platform/network-activation/page.tsx");
const gate=read("../../../.github/workflows/p0-required-gate.yml");
const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");

test("NET-CONNECT2C: real same-cohort stages not independent vanity stages",()=>{
 assert.match(migration,/a\.submitted_at at time zone 'UTC'/);
 assert.match(migration,/a\.submitted_at is not null/);
 assert.match(migration,/submitted_at>=now\(\)-interval '30 days'/);
 assert.match(migration,/r\.status='accepted'/);
 assert.match(migration,/owner_ready as materialized/);
 for(const key of ["submitted","activated","owned","requested","accepted"]){
  assert.match(page,new RegExp('key:"'+key+'"'));
 }
 assert.match(page,/stessa coorte di domande/);
 assert.match(page,/non eventi verificatisi/);
});
test("NET-CONNECT2C: real verified business access and response",()=>{
 assert.match(migration,/cl\.status='approved'/);
 assert.match(migration,/l\.link_status='active'/);
 assert.match(migration,/m\.status='active'/);
 assert.match(migration,/owned_without_outreach/);
 assert.doesNotMatch(migration,/insert into public\.|update public\./);
});
test("NET-CONNECT2C: owner-only SQL, UI and CI gate",()=>{
 assert.match(page,/!access\?\.is_platform_owner/);
 assert.match(migration,/private\.is_platform_superadmin\(\)/);
 assert.match(migration,/revoke all on function public\.netconnect2c_growth_overview\(\) from public,anon/);
 assert.match(migration,/revoke all on function private\.netconnect2c_growth_impl\(\) from public,anon,authenticated/);
 assert.match(helper,/rpc\("netconnect2c_growth_overview"\)/);
 assert.match(hp13,/public\.netconnect2c_growth_overview\(\)/);
 assert.match(gate,/netconnect2c_activation_growth\.sql/);
});
