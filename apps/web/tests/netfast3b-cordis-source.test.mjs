import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const schema=read("../../../supabase/migrations/20261016233000_netfast3b_cordis_research_schema.sql");
const proc=read("../../../supabase/migrations/20261016233100_netfast3b_cordis_licensed_worker_rpcs.sql");
const readRpc=read("../../../supabase/migrations/20261016233200_netfast3b_cordis_platform_read.sql");
const worker=read("../../../services/worker/app/netfast3b_cordis_feed.py");
const workflow=read("../../../.github/workflows/netfast3b-cordis-monthly.yml");
const platform=read("../app/(platform)/platform/company-discovery/bulk/page.tsx");
test("NET-FAST3B requires actual grant and never seeds pretend permissions",()=>{
 assert.match(schema,/governance_status/);
 assert.match(schema,/false/);
 assert.match(proc,/network_netfast3_feed_grants/);
 assert.match(proc,/g.revoked_at is null and g.expires_at>now\(\)/);
 assert.match(proc,/cordis_source_rights_not_approved/);
 assert.match(proc,/current_user<>'service_role'/);
});
test("NET-FAST3B remains bounded and never self-publishes verified companies",()=>{
 assert.match(proc,/jsonb_array_length\(p_items\) not between 1 and 500/);
 assert.match(proc,/scanned_count\+jsonb_array_length\(p_items\)>30000/);
 assert.match(proc,/network_netfast3b_cordis_research/);
 assert.match(proc,/network_netfast3_entities/);
 assert.doesNotMatch(proc+schema,/insert into public.network_companies/);
 assert.match(worker,/MAX_DOWNLOAD = 90_000_000/);
 assert.match(worker,/Do not copy VAT/);
 assert.match(worker,/organi[sz]ationWebsite/);
});
test("NET-FAST3B monthly main-only worker and Platform reporting",()=>{
 assert.match(workflow,/cron: "47 3 5 \* \*"/);
 assert.match(workflow,/github.ref == 'refs\/heads\/main'/);
 assert.match(readRpc,/private.require_platform_permission\('discovery.read'\)/);
 assert.match(platform,/netfast3b_status/);
});
