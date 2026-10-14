import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const runner=readFileSync(new URL("./rqg32h-local-company-review-positive.mjs",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../../../.github/workflows/perf1-chrome-auth.yml",import.meta.url),"utf8");
const manual=readFileSync(new URL("../../../.github/workflows/rqg32h-disposable-company-review.yml",import.meta.url),"utf8");
const fixture=readFileSync(new URL("../../../supabase/tests/rqg31_local_fixture.sql",import.meta.url),"utf8");
const base=readFileSync(new URL("../../../supabase/tests/perf1_chrome_seed.sql",import.meta.url),"utf8");
test("RQG3.2h uses only disposable local Next and Supabase, never hosted data",()=>{
  assert.match(runner,/assert\.equal\(process\.env\.PERF1_WEB_URL,WEB/);
  assert.match(runner,/http:\/\/127\.0\.0\.1:54321/);
  assert.match(runner,/assert\.match\(process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(runner,/assert\.ok\(process\.env\.RUNNER_TEMP/);
  assert.doesNotMatch(runner,/https:\/\/|smartsteelsales\.com|sb_secret_|service_role/);
  assert.match(manual,/uses: \.\/\.github\/workflows\/perf1-chrome-auth\.yml/);
  assert.doesNotMatch(manual,/environment: production|secrets:|upload-artifact/);
});
test("RQG3.2h authenticates real GoTrue sessions and checks Company A/B own-only, viewer/staff/Owner denied",()=>{
  assert.match(runner,/signInWithPassword/);
  assert.match(runner,/chromium\.launch/);
  assert.match(runner,/\/operations\/review/);
  assert.match(runner,/\/platform\/review/);
  assert.match(runner,/lr5_current_legal_acceptance_state/);
  assert.match(runner,/expected\[actor\.id\]/);
  assert.match(runner,/RQG31 PRIVATE A/);
  assert.match(runner,/RQG31 PRIVATE B/);
  assert.match(runner,/buyerViewer/);
  assert.match(runner,/platformStaff/);
  assert.match(runner,/owner/);
  assert.match(runner,/\.from\("commercial_review_queue"\)/);
  assert.doesNotMatch(runner,/auth\.admin|\.insert\(|\.update\(|\.delete\(|\.rpc\("lr5_record_legal_acceptance"/);
});
test("RQG3.2h disposable fixture has two distinct private Review queues and current local-only legal gate",()=>{
  assert.match(fixture,/RQG31 PRIVATE A/);
  assert.match(fixture,/RQG31 PRIVATE B/);
  assert.match(fixture,/98031/);
  assert.match(fixture,/98034/);
  assert.match(base,/user_legal_acceptances/);
  assert.match(base,/buyerViewer_user_id/);
  assert.match(base,/2026-10-04-lr5-v1/);
  assert.match(base,/Never execute this file against hosted Supabase/);
});
test("RQG3.2h automation is manual opt-in and full preexisting mutation/RLS tests run AFTER read-only Company acceptance",()=>{
  assert.match(workflow,/  workflow_call:/);
  assert.match(workflow,/  workflow_dispatch:/);
  assert.match(workflow,/apps\/web\/tests\/rqg32h-\*\.mjs/);
  assert.match(workflow,/rqg32h-local-company-review-positive\.mjs/);
  assert.ok(workflow.indexOf("node tests/rqg32h-local-company-review-positive.mjs")<
    workflow.indexOf("node tests/rqg31-chrome-multi-role.mjs"));
  assert.match(workflow,/supabase start/);
  assert.match(workflow,/supabase db reset --local/);
  assert.match(workflow,/supabase stop --no-backup/);
  assert.match(manual,/workflow_dispatch:/);
  assert.doesNotMatch(manual,/^\s+(push|schedule|pull_request):/m);
});
