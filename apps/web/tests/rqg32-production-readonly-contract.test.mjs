import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
const source = readFileSync(new URL("./rqg32-production-authenticated-readonly.mjs", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../../../.github/workflows/rqg32-production-auth-review.yml", import.meta.url), "utf8");
const doc = readFileSync(new URL("../../../docs/architecture/rqg32-authenticated-production-acceptance.md", import.meta.url), "utf8");

test("RQG3.2 production acceptance runs manually with dedicated synthetic identities", () => {
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/^\s+(pull_request|push|schedule):/m);
  assert.match(workflow,/I_APPROVE_READ_ONLY_RQG32/);
  assert.match(workflow,/environment: production-qa/);
  assert.doesNotMatch(workflow.split("    steps:")[0],/RQG32_.*(EMAIL|PASSWORD|MARKER)/,
    "Dedicated production secrets must not be job-global");
  assert.match(workflow,/persist-credentials: false/);
  assert.equal((workflow.match(/RQG32_REGISTRATION_PASSWORD: /g) ?? []).length,2,
    "Secrets should be scoped only to readiness and Chrome");
  assert.equal((workflow.match(/RQG32_COMPANY_A_MARKER: /g) ?? []).length,2);
  assert.match(workflow,/if: github.ref == 'refs\/heads\/main' && github.event_name == 'workflow_dispatch'/);
  assert.match(workflow,/RQG32A_MODE: ready/);
  assert.match(workflow,/RQG32A_APPROVAL: RQG32A_INSPECT_SYNTHETIC_USERS/);
  assert.match(workflow,/secrets\.RQG32A_AUTH_SECRET_KEY/);
  assert.ok(workflow.indexOf("Enforce seven governed synthetic roles") <
    workflow.indexOf("Install ephemeral Chrome"),
    "Readiness must fail BEFORE browser installation/sign-in");
  assert.equal(existsSync(new URL("../../../.github/workflows/rqg32-production-authenticated-review.yml", import.meta.url)), false,
    "Legacy eight-persona/second-owner workflow is unsafe");
  assert.equal(existsSync(new URL("./rqg32-production-authenticated-chrome.mjs", import.meta.url)), false,
    "Legacy second-Owner browser script must be retired");
  assert.match(source,/^const ORIGIN = "https:\/\/www\.smartsteelsales\.com";/m);
  assert.match(source,/^const SUPABASE_ORIGIN = "https:\/\/ecrafjdummcdfycznitx\.supabase\.co";/m);
  assert.match(source,/\^rqg32\[-\.\+\]/);
  assert.match(source,/const defs = \[/);
  assert.match(source,/assert\.equal\(new Set\(actors\.map/);
  for (const actor of ["registration","claims","trust","auditor","companyA","companyB","viewer"]) {
    assert.match(source,new RegExp('id: "'+actor+'"'),actor);
  }
  assert.match(workflow,/secrets\.RQG32_COMPANY_A_MARKER/);
  assert.match(workflow,/secrets\.RQG32_COMPANY_B_MARKER/);
});
test("RQG3.2 has no prod decisions, DB writes, or privileged owner credentials", () => {
  assert.match(source,/request\.method\(\) === "GET" \|\| request\.method\(\) === "HEAD"/);
  assert.match(source,/url\.pathname === loginPath/);
  assert.match(source,/url\.pathname === "\/auth\/v1\/token"/);
  assert.match(source,/return route\.abort\(\)/);
  assert.doesNotMatch(source,/\.rpc\(|\.from\(|service_role|admin\.createUser|\.update\(|\.insert\(/);
  assert.doesNotMatch(source,/\.(click|press)\(["'].*(Conferma|Approva|Correggi)/);
  assert.doesNotMatch(workflow,/RQG32_OWNER_(EMAIL|PASSWORD)/);
  assert.match(source,/requiredEmails/);
  assert.match(source,/exact synthetic persona emails/);
  assert.match(source,/RQG32-ORG_A-20261013/);
  assert.match(source,/RQG32-ORG_B-20261013/);
  assert.match(source,/GITHUB_REF, "refs\/heads\/main"/);
  assert.match(doc,/BLOCKED — not green/);
  assert.match(doc,/live-auth-pending/);
  assert.doesNotMatch(workflow,/upload-artifact/);
});
