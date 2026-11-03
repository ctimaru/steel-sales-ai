import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261103090000_netconn4_sender_company_profile.sql");
const code=sql.replace(/--[^\n]*/g,"");
const inbox=read("../app/(italian)/(workspace)/network/connections/page.tsx");

test("NET-CONN4 resolves the sender profile only from a governed, published claim",()=>{
 assert.match(sql,/'sender_network_company_id',q\.sender_network_company_id/);
 assert.match(sql,/public\.organization_network_company_links l/);
 assert.match(sql,/l\.organization_id=i\.sender_organization_id and l\.link_status='active'/);
 assert.match(sql,/cl\.status='approved'/);
 assert.match(sql,/c\.publication_status='published' and c\.archived_at is null/);
 assert.match(sql,/left join lateral/);
});

test("NET-CONN4 keeps tenant scoping and changes no data or privileges",()=>{
 assert.match(sql,/private\.netux11_require_active_company\(p_organization_id\)/);
 assert.match(sql,/public\.organization_memberships/);
 assert.match(sql,/revoke all on function private\.netconnect1_list_impl\(uuid,text,integer,integer\) from public,anon,authenticated/);
 assert.doesNotMatch(code,/\b(insert into|update public\.|delete from|alter table|create table|grant )/i);
});

test("NET-CONN4 links received requests to the sender, never to the reader's own company",()=>{
 assert.match(inbox,/item\.direction==="sent"\?item\.company_id:item\.sender_network_company_id\|\|null/);
 assert.doesNotMatch(inbox,/box==="received"[^\n]*"\/network\/"\+item\.company_id/);
 assert.doesNotMatch(inbox,/direction==="received"[^\n]*"\/network\/"\+item\.company_id/);
 // No profile link when the sender has no published company.
 assert.match(inbox,/otherCompanyId\(item\)\?<Link href=\{"\/network\/"\+otherCompanyId\(item\)\}/);
});
