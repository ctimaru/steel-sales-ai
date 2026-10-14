import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const runner=readFileSync(new URL("./rqg32f-production-platform-chrome.mjs",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../../../.github/workflows/rqg32f-production-platform-auth.yml",import.meta.url),"utf8");

test("RQG3.2f exact four synthetic staff personas, no owner or tenant persona",()=>{
  for(const role of ["registration","claims","trust","auditor"]) {
    assert.match(runner,new RegExp('id:"'+role+'"'));
    assert.match(runner,new RegExp('rqg32-'+role+'@smartsteelsales\\.test'));
  }
  assert.equal((runner.match(/id:"(registration|claims|trust|auditor)"/g)||[]).length,4);
  assert.doesNotMatch(runner,/companyA|companyB|companyViewer|OWNER_PASSWORD|service_role/);
  assert.match(runner,/RQG32F_APPROVE_PLATFORM_READ_ONLY/);
});
test("RQG3.2f only permits authenticated login writes; tenant Review denied",()=>{
  assert.match(runner,/method==="GET"\|\|method==="HEAD"/);
  assert.match(runner,/url\.pathname==="\/login"/);
  assert.match(runner,/url\.pathname==="\/auth\/v1\/token"/);
  assert.match(runner,/return route\.abort\("blockedbyclient"\)/);
  assert.match(runner,/await deny\(context,"\/operations\/review"\)/);
  assert.match(runner,/actor\.lanes\.slice\(\)\.sort\(\)/);
  assert.match(runner,/Sola lettura · nessuna decisione autorizzata/);
  assert.doesNotMatch(runner,/\.rpc\(|\.from\(|\.insert\(|\.update\(/);
});
test("RQG3.2f protected manual-only workflow scopes four passwords to Chrome step",()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/environment: production-qa/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(workflow,/^\s+(push|schedule|pull_request):/m);
  assert.equal((workflow.match(/secrets\.RQG32_\w+_PASSWORD/g)||[]).length,4);
  assert.doesNotMatch(workflow.split("    steps:")[0],/PASSWORD|SECRET_KEY/);
  assert.doesNotMatch(workflow,/RQG32A_AUTH_SECRET_KEY|OWNER_PASSWORD|upload-artifact/);
});
