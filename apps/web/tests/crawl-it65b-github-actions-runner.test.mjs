import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261014170000_crawl_it65b_github_actions_runner.sql");
const suite=read("../../../supabase/tests/crawl_it65b_github_actions_runner.sql");
const script=read("../../../services/worker/app/github_actions_crawler.py");
const workflow=read("../../../.github/workflows/crawl-it65b-weekly-discovery.yml");
const p0=read("../../../.github/workflows/p0-required-gate.yml");

test("CRAWL-IT6.5b one-source SQL gate is privilege-scoped, atomic and never publishes",()=>{
  assert.match(sql,/current_user <> 'service_role'/);
  assert.match(sql,/security invoker set search_path=''/);
  assert.match(sql,/from public\.network_discovery_source_registry/);
  assert.match(sql,/source_url='https:\/\/query\.wikidata\.org\/sparql'/);
  assert.match(sql,/max_domains_per_run between 1 and 5/);
  assert.match(sql,/minimum_interval_hours >= 168/);
  assert.match(sql,/for update;/);
  assert.match(sql,/v_evidence !~ '\^https:\/\/www/);
  assert.match(sql,/v_url is distinct from 'https:\/\/' \|\| v_domain \|\| '\/'/);
  assert.match(sql,/existing_network/);
  assert.match(sql,/existing_leads/);
  assert.match(sql,/existing_candidates/);
  assert.match(sql,/status\)[\n\s]*values \(v_source\.id,'IT',v_domain,v_url,v_evidence,'pending_review'\)/);
  assert.match(sql,/revoke all on function public\.crawl_it65b_commit_wikidata_leads\(jsonb\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.crawl_it65b_commit_wikidata_leads\(jsonb\) to service_role/);
  assert.doesNotMatch(sql,/\binsert into public\.network_companies\b|\bupdate public\.network_companies\b|\bdelete from public\.network_companies\b/i);
  assert.doesNotMatch(sql,/\binsert into public\.network_facilities\b|\bupdate public\.network_facilities\b/i);
  assert.match(suite,/Idempotent replay must skip known lead/);
  assert.match(suite,/Weekly source cooldown failed/);
  assert.match(p0,/crawl_it65b_github_actions_runner\.sql/);
});

test("CRAWL-IT6.5b schedule is main-only and off-by-default",()=>{
  assert.match(workflow,/schedule:/);
  assert.match(workflow,/cron: "47 15 \* \* 3"/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/vars\.CRAWL_IT65B_ENABLED == 'true'/);
  assert.match(workflow,/concurrency:/);
  assert.match(workflow,/cancel-in-progress: false/);
  assert.match(workflow,/timeout-minutes: 6/);
  assert.match(workflow,/permissions:\n  contents: read/);
  assert.match(workflow,/secrets\.CRAWL_IT65B_SUPABASE_SECRET_KEY/);
  assert.match(workflow,/inputs\.mode == 'preview'/);
  assert.match(workflow,/inputs\.mode == 'stage'/);
  assert.doesNotMatch(workflow,/pull_request:|workflow_run:|release:|push:\n/);
});

test("CRAWL-IT6.5b runner fail-closed, dedicated sb_secret API key and no publishing",()=>{
  assert.match(script,/EXPECTED_SUPABASE_HOST = "ecrafjdummcdfycznitx\.supabase\.co"/);
  assert.match(script,/not key\.startswith\("sb_secret_"\)/);
  assert.match(script,/"apikey": key/);
  assert.doesNotMatch(script, /headers:\s*\{[^}]*Authorization|headers:\s*\{[^}]*Bearer /);
  assert.match(script,/source_preflight/);
  assert.match(script,/commit_wikidata_leads/);
  assert.match(script,/preview_wikidata_steel_italy\(limit=budget\)/);
  assert.match(script,/CRAWL_IT65B_ENABLED/);
  assert.match(script,/result\.get\("published"\) != 0/);
  assert.match(script,/Zero|published": 0/);
});
