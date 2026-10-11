import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
test("CRAWL-IT6.1 geo review is permission gated and separate from publication",()=>{
 const page=read("app/(platform)/platform/company-discovery/geo-review/page.tsx");
 const action=read("app/(platform)/platform/company-discovery/geo-review/actions.ts");
 const sql=read("../../supabase/migrations/20261011120000_crawl_it61_geo_review_console.sql");
 assert.match(page,/requirePlatformPermission\("discovery\.read"\)/);
 assert.match(page,/discovery\.governance_review/);
 assert.match(action,/requirePlatformPermission\("discovery\.governance_review"\)/);
 assert.match(sql,/private\.require_platform_permission\('discovery\.read'\)/);
 assert.match(sql,/private\.require_platform_permission\('discovery\.governance_review'\)/);
 assert.match(sql,/v\.status <> 'pending_review'/);
 assert.match(sql,/facility_published',false/);
 assert.doesNotMatch(sql,/insert into public\.network_facilities|update public\.network_facilities/);
});
