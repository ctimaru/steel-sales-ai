import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const file=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const storage=file("../../../supabase/migrations/20261016223000_netfast2_structured_cc0_storage.sql");
const batch=file("../../../supabase/migrations/20261016223100_netfast2_daily_batch_rpc.sql");
const source=file("../../../supabase/migrations/20261016223200_netfast2_free_discovered_union.sql");
const worker=file("../../../services/worker/app/netfast2_wikidata_feed.py");
const schedule=file("../../../.github/workflows/netfast2-wikidata-feed.yml");
test("NETFAST2 loads only independently licensed Wikidata structured entities",()=>{
 assert.match(storage,/Wikidata:Licensing/);
 assert.match(storage,/max_domains_per_run=100/);
 assert.match(storage,/reviewed_by is not null/);
 assert.match(batch,/netfast2_claim_daily_batch/);
 assert.match(batch,/current_user<>'service_role'/);
 assert.match(worker,/wdt:P17 wd:Q38/);
 assert.match(worker,/FILTER NOT EXISTS/);
 assert.match(worker,/wdt:P856 \?website/);
});
test("NETFAST2 ingestion is bounded and never canonical publication",()=>{
 assert.match(batch,/jsonb_array_length\(p_items\)>100/);
 assert.match(batch,/on conflict\(run_day\) do nothing/);
 assert.match(source,/network_netfast2_structured_entities/);
 assert.match(source,/removed_at is null/);
 assert.doesNotMatch(batch+storage+source,/insert into public.network_companies/);
 assert.match(worker,/no retry/i);
});
test("NETFAST2 legacy worker remains manual on main with source review and no browser credentials",()=>{
 assert.doesNotMatch(schedule,/cron:/);
 assert.match(schedule,/github.ref == 'refs\/heads\/main'/);
 assert.match(schedule,/CRAWL_IT65B_SUPABASE_SECRET_KEY/);
 assert.match(worker,/credentials_from_environment/);
});
