import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (p) => readFileSync(new URL(p,import.meta.url),"utf8");
const workflow = read("../../../.github/workflows/staging-ready2b-hosted-auth.yml");
const setup = read("./staging-ready2b-fixtures.mjs");
const browser = read("./staging-ready2b-chrome-auth.mjs");
const seed = read("../../../supabase/tests/staging_ready2b_seed.sql");
const cleanup = read("../../../supabase/tests/staging_ready2b_cleanup.sql");

test("STAGING-READY2B is manual, protected-main, explicitly approved and staging-only",()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n  (?:push|pull_request|schedule):/);
  assert.match(workflow,/test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow,/STAGING_READY2B_TEST_SYNTHETIC_ONLY/);
  assert.match(workflow,/STAGING_READY2B_CLEAN_RESERVED_ONLY/);
  assert.match(workflow,/STAGING_READY2B_READ_ONLY/);
  assert.match(workflow,/STAGING_READY1_DB_URL: \$\{\{ secrets\.STAGING_READY1_DB_URL \}\}/);
  assert.match(workflow,/STAGING_READY2B_AUTH_SECRET_KEY: \$\{\{ secrets\.STAGING_READY2B_AUTH_SECRET_KEY \}\}/);
  assert.match(workflow,/python3 scripts\/staging-ready1-target-guard\.py/);
  assert.match(workflow,/if: inputs\.mode == 'accept'/);
  assert.match(workflow,/if: always\(\) && steps\.target\.outcome == 'success'/);
  assert.match(workflow,/steps\.cleanup_sql\.outcome == 'success'/);
  assert.doesNotMatch(workflow,/ecrafjdummcdfycznitx|www\.smartsteelsales\.com/);
});

test("STAGING-READY2B uses only reserved Auth personas and never grants platform authority",()=>{
  assert.match(setup,/lwrrrphakpbjhbzljqhn/);
  assert.match(setup,/admin\.auth\.admin\.createUser/);
  assert.match(setup,/admin\.auth\.admin\.deleteUser/);
  assert.match(setup,/STAGING_READY2B_ONLY/);
  assert.match(setup,/sr2b-admin-a@smartsteelsales\.test/);
  assert.match(setup,/sr2b-admin-b@smartsteelsales\.test/);
  assert.match(setup,/sr2b-viewer-a@smartsteelsales\.test/);
  assert.doesNotMatch(setup,/platform_superadmin|platform_staff|production-qa/);
  assert.match(setup,/mode: 0o600/);
  assert.match(workflow,/RESEND_API_KEY: ""/);
});

test("STAGING-READY2B creates only 2 orgs, 3 memberships and private draft RFQs",()=>{
  assert.match(seed,/^BEGIN;/m);
  assert.match(seed,/^COMMIT;/m);
  assert.match(seed,/public\.organizations/);
  assert.match(seed,/public\.organization_memberships/);
  assert.match(seed,/public\.user_legal_acceptances/);
  assert.match(seed,/public\.buyer_rfq_campaigns/);
  assert.match(seed,/SR2B BUYER A PRIVATE RFQ/);
  assert.match(seed,/SR2B TRADER B PRIVATE RFQ/);
  assert.match(seed,/'viewer'/);
  assert.doesNotMatch(seed,/\b(?:TRUNCATE|DROP TABLE|ALTER TABLE|GRANT ALL)\b/i);
  assert.match(cleanup,/^BEGIN;/m);
  assert.match(cleanup,/^COMMIT;/m);
  assert.match(cleanup,/public\.buyer_rfq_campaigns/);
  assert.match(cleanup,/public\.organizations/);
  assert.match(cleanup,/Unexpected organization identity: cleanup denied/);
  assert.match(cleanup,/LR5 compliance evidence is immutable/);
  assert.doesNotMatch(cleanup,/DELETE\s+FROM\s+public\.user_legal_acceptances/i,
    "Immutable LR5 acceptance records must not be deleted by staging cleanup");
  assert.doesNotMatch(cleanup,/\b(?:TRUNCATE|DROP TABLE|ALTER TABLE)\b/i);
});

test("STAGING-READY2B browser compares tenants, protected previews and both viewports",()=>{
  assert.match(browser,/steel-sales-jl6222xfv-ctimaru-5113\.vercel\.app/);
  assert.match(browser,/steel-sales-gaq3y2k9i-ctimaru-5113\.vercel\.app/);
  assert.match(browser,/width of \[1440,390\]/);
  assert.match(browser,/adminA","adminB","viewerA"/);
  assert.match(browser,/x-vercel-protection-bypass/);
  assert.match(browser,/if\(url\.origin!==origin\) return route\.continue\(\)/);
  assert.match(browser,/blockedbyclient/);
  assert.match(browser,/\/commercial\?item=campaign:/);
  assert.match(browser,/Horizontal overflow/);
  assert.doesNotMatch(browser,/screenshot\(|video:|trace:|www\.smartsteelsales\.com/);
});

test("hosted QA entrypoints parse under Node 22 before any hosted writes",()=>{
  for(const file of ["staging-ready2b-fixtures.mjs","staging-ready2b-chrome-auth.mjs"]){
    const input=fileURLToPath(new URL("./"+file,import.meta.url));
    const result=spawnSync(process.execPath,["--check",input],{encoding:"utf8"});
    assert.equal(result.status,0,file+" syntax rejected: "+result.stderr);
  }
});
