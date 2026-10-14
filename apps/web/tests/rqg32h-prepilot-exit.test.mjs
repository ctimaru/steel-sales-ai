import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const path=(file)=>readFileSync(new URL(file,import.meta.url),"utf8");
const local=path("./rqg32h-local-company-review-positive.mjs");
const e2e=path("../../../.github/workflows/perf1-chrome-auth.yml");
const manual=path("../../../.github/workflows/rqg32h-disposable-company-review.yml");
const live=path("../../../.github/workflows/rqg32i-production-company-pilot.yml");
const plan=path("../../../docs/architecture/rqg32j-prepilot-technical-exit.md");

test("RQG3.2j: synthetic positive Company A/B + viewer denial stays local-only",()=>{
  assert.match(local,/DISPOSABLE LOCAL/);
  assert.match(local,/RQG31 PRIVATE A/);
  assert.match(local,/RQG31 PRIVATE B/);
  assert.match(local,/buyerViewer/);
  assert.match(local,/platformStaff/);
  assert.match(local,/from\("commercial_review_queue"\)/);
  assert.match(local,/lr5_current_legal_acceptance_state/);
  assert.match(local,/localhost|127\.0\.0\.1/);
  assert.doesNotMatch(local,/https:\/\/www\.smartsteelsales\.com/);
});

test("RQG3.2j: disposable E2E includes real GoTrue, RLS, Chrome decisions and teardown",()=>{
  assert.match(e2e,/workflow_call:/);
  assert.match(e2e,/supabase start/);
  assert.match(e2e,/supabase db reset --local/);
  assert.match(e2e,/tests\/rqg32h-local-company-review-positive\.mjs/);
  assert.match(e2e,/tests\/rqg31-chrome-multi-role\.mjs/);
  assert.ok(e2e.indexOf("node tests/rqg32h-local-company-review-positive.mjs")<
    e2e.indexOf("node tests/rqg31-chrome-multi-role.mjs"));
  assert.match(e2e,/supabase stop --no-backup/);
  assert.match(manual,/workflow_dispatch:/);
  assert.doesNotMatch(manual,/environment: production-qa|secrets:|upload-artifact/);
});

test("RQG3.2j: hosted positive pilot remains protected, manual, consent-dependent and deferred",()=>{
  assert.match(live,/workflow_dispatch:/);
  assert.match(live,/environment: production-qa/);
  assert.match(live,/refs\/heads\/main/);
  assert.match(live,/RQG32I_APPROVE_CONSENTED_PILOT_READ_ONLY/);
  assert.doesNotMatch(live,/^\s+(push|pull_request|schedule):/m);
  assert.match(plan,/DEFERRED/);
  assert.match(plan,/RQG4/);
  assert.match(plan,/NOT a pre-pilot release blocker/);
  assert.doesNotMatch(plan,/Company.*production.*\| PASS/);
});
