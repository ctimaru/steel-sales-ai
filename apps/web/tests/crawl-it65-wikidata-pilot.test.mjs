import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const read = p => readFileSync(new URL(p,import.meta.url),"utf8");
const migration = read("../../../supabase/migrations/20261014150000_crawl_it65_wikidata_source_proposal.sql");
const sqlTest = read("../../../supabase/tests/crawl_it65_wikidata_source_pilot.sql");
const source = read("../app/(italian)/(platform)/platform/company-discovery/sources/page.tsx");
const actions = read("../app/(italian)/(platform)/platform/company-discovery/sources/actions.ts");
const harvester = read("../../../services/worker/app/italian_source_discovery.py");
const wikidata = read("../../../services/worker/app/wikidata_source_discovery.py");
const workflow = read("../../../.github/workflows/crawl-it65-wikidata-readonly-pilot.yml");
const p0 = read("../../../.github/workflows/p0-required-gate.yml");

test("CRAWL-IT6.5 stages official CC0 source without approval or worker enable",()=>{
  assert.match(migration,/https:\/\/query\.wikidata\.org\/sparql/);
  assert.match(migration,/Wikidata:Licensing/);
  assert.match(migration,/'unreviewed','not_checked','not_assessed','not_assessed'/);
  assert.match(migration,/false,5,168/);
  assert.doesNotMatch(migration,/reviewed_by\s*,|reviewed_at\s*,|update public\.|delete from public\./i);
  assert.match(sqlTest,/enabled_for_discovery/);
  assert.match(sqlTest,/if exists\(select 1 from public\.network_discovery_domain_leads/);
  assert.match(p0,/crawl_it65_wikidata_source_pilot\.sql/);
});
test("CRAWL-IT6.5 operator opt-in checks user intent and source identity, no schedule",()=>{
  assert.match(actions,/requirePlatformPermission\("discovery\.governance_review"\)/);
  assert.match(actions,/form\.get\("activation_attested"\)/);
  assert.match(actions,/p_enable: enable/);
  assert.match(actions,/item\?\.source_url !== "https:\/\/query\.wikidata\.org\/sparql"/);
  assert.match(source,/name="activation_attested"/);
  assert.match(source,/name="enable"/);
  assert.match(source,/CRAWL_IT3_ENABLED/);
  assert.match(harvester,/os\.getenv\("CRAWL_IT3_ENABLED", "false"\)/);
  assert.match(harvester,/WIKIDATA_SOURCE_URL/);
  assert.match(harvester,/status": "pending_review"/);
});
test("CRAWL-IT6.5 bounded manual workflow makes public preview without credentials",()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/contents: read/);
  assert.match(workflow,/working-directory: services\/worker/);
  assert.match(workflow,/app\.wikidata_source_discovery --limit/);
  assert.doesNotMatch(workflow,/SUPABASE_SERVICE_ROLE_KEY|WORKER_INTERNAL_TOKEN|CRAWL_IT3_ENABLED|railway deploy|vercel/);
  assert.match(wikidata,/follow_redirects=False/);
  assert.match(wikidata,/MAX_RESPONSE_BYTES = 512_000/);
  assert.match(wikidata,/wdt:P17 wd:Q38/);
  assert.match(wikidata,/wdt:P452 wd:Q2285982/);
  assert.match(wikidata,/READ_ONLY_DRY_RUN/);
});
