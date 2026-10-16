import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const schema=read("../../../supabase/migrations/20261016240000_netlaunch2_cc0_density_schema.sql");
const rpc=read("../../../supabase/migrations/20261016240100_netlaunch2_cc0_density_rpc.sql");
const order=read("../../../supabase/migrations/20261016240200_netlaunch2_latest_companies_first.sql");
const worker=read("../../../services/worker/app/netlaunch2_wikidata_density.py");
const workflow=read("../../../.github/workflows/netlaunch2-cc0-company-density.yml");
const legacy=read("../../../.github/workflows/netfast2-wikidata-feed.yml");
test("NET-LAUNCH2 inserts actual entity IDs, excludes CRM and unapproved sources",()=>{
 assert.match(rpc,/values\(qid,nm,dom,web,sector\)/);
 assert.match(rpc,/network_netfast3_suppressed_domains/);
 assert.match(rpc,/src\.governance_status<>'approved'/);
 assert.match(rpc,/current_user<>'service_role'/);
 assert.doesNotMatch(rpc,/insert into public.network_companies/);
});
test("NET-LAUNCH2 2-page daily budget and newest Free list",()=>{
 assert.match(schema,/max_domains_per_run=200/);
 assert.match(rpc,/jsonb_array_length\(p_items\)>200/);
 assert.match(order,/eligible order by created_at desc,id desc/);
 assert.match(worker,/SELECT DISTINCT \?item \?website \?label/);
 assert.match(worker,/LIMIT 100/);
});
test("Daily new workflow replaces duplicate legacy schedule",()=>{
 assert.match(workflow,/cron: "11 3 \* \* \*"/);
 assert.doesNotMatch(legacy,/cron:/);
 assert.match(workflow,/netlaunch2_wikidata_density/);
});
