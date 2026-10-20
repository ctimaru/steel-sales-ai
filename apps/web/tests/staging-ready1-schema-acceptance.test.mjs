import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const pythonGuard = fileURLToPath(new URL("../../../scripts/staging-ready1-target-guard.py", import.meta.url));
const workflow = readFileSync(new URL("../../../.github/workflows/staging-ready1-schema-acceptance.yml", import.meta.url), "utf8");
const preflight = readFileSync(new URL("../../../supabase/tests/staging_ready1_isolation_preflight.sql", import.meta.url), "utf8");
const pristine = readFileSync(new URL("../../../supabase/tests/staging_ready1_pristine_guard.sql", import.meta.url), "utf8");
const staging = "lwrrrphakpbjhbzljqhn";
const production = "ecrafjdummcdfycznitx";
const direct = `postgresql://postgres:fictional-test-value@db.${staging}.supabase.co:5432/postgres`;

function check(url, ref = staging, mode = "plan") {
  return spawnSync("python3", [pythonGuard], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      REQUESTED_PROJECT_REF: ref,
      REQUESTED_RUN_MODE: mode,
      STAGING_READY1_DB_URL: url,
    },
  });
}

test("staging accepts exact direct or pooler connection with staging confirmation", () => {
  for (const url of [
    direct,
    direct + "?sslmode=require",
    `postgresql://postgres.${staging}:fictional-test-value@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`,
  ]) {
    const outcome = check(url);
    assert.equal(outcome.status, 0, outcome.stdout + outcome.stderr);
    assert.doesNotMatch(outcome.stdout + outcome.stderr, /fictional-test-value/);
  }
});

test("reserved password characters are normalized without printing credentials", () => {
  for (const rawPassword of ["a#b/c?d@e", "abc%2Fxyz", "abc:xyz", "a[b]c"]) {
    const url = `postgresql://postgres.${staging}:${rawPassword}@aws-1-eu-west-3.pooler.supabase.com:5432/postgres`;
    const result = check(url);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /a#b|abc%2F|abc:xyz|a\\[b\\]c/);
  }
});

test("guard fails closed for production, spoofed hosts and missing confirmation", () => {
  for (const [url, ref, mode] of [
    [direct, production, "plan"],
    [direct, staging, "deploy"],
    [`postgresql://postgres:secret@db.${production}.supabase.co:5432/postgres`, staging, "plan"],
    [`postgresql://postgres:secret@db.${staging}.supabase.co.attacker.tld:5432/postgres`, staging, "apply"],
    [`postgresql://postgres.${production}:secret@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`, staging, "plan"],
    [direct + "?host=db." + production + ".supabase.co", staging, "plan"],
    [direct + "?sslmode=disable", staging, "apply"],
    [`postgresql://postgres:[YOUR-PASSWORD]@db.${staging}.supabase.co:5432/postgres`, staging, "plan"],
    ["", staging, "plan"],
  ]) {
    const outcome = check(url, ref, mode);
    assert.notEqual(outcome.status, 0);
    assert.doesNotMatch(outcome.stdout + outcome.stderr, /fictional-test-value|postgresql:\/\//);
  }
});

test("push is branch-scoped dry-run; remote write is manual-only", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\n    branches:\n      - feat\/staging-ready1-isolated-schema-acceptance/);
  assert.doesNotMatch(workflow, /\n  pull_request:/);
  assert.match(workflow, /github.event_name == 'push' && 'plan'/);
  assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.run_mode == 'apply'/);
  assert.match(workflow, /STAGING_READY1_DB_URL: \$\{\{ secrets\.STAGING_READY1_DB_URL \}\}/);
  assert.match(workflow, /supabase db push --db-url "\$STAGING_READY1_DB_URL" --dry-run/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && inputs\.run_mode == 'apply'/);
  assert.match(workflow, /supabase db push --db-url "\$STAGING_READY1_DB_URL" --yes/);
  assert.ok(workflow.indexOf("Check target identity") < workflow.indexOf("Plan all remote"));
  assert.ok(workflow.indexOf("Plan all remote") < workflow.indexOf("Apply schema"));
  assert.match(workflow, /p0_pre_worker_baseline\.sql/);
  assert.match(workflow, /p0_staging_baseline\.sql/);
  assert.match(workflow, /p0_tenant_isolation\.sql/);
  assert.match(workflow, /p1_tenant_onboarding\.sql/);
  assert.match(workflow, /Reject nonempty staging before schema application/);
  assert.match(workflow, /-f supabase\\/tests\\/staging_ready1_pristine_guard\\.sql/);
  assert.doesNotMatch(workflow, /<<'SQL'/);
  assert.match(pristine, /DO \\$staging_ready1_pristine\\$/);
  assert.match(pristine, /\\$staging_ready1_pristine\\$;/);
  assert.match(pristine, /auth\\.users/);
  assert.match(pristine, /table_schema = 'public'/);
  assert.doesNotMatch(pristine, /\\bINSERT\\b|\\bDELETE\\b|\\bTRUNCATE\\b/i);
  assert.match(preflight, /auth\.users/);
  assert.match(preflight, /relrowsecurity/);
  assert.doesNotMatch(preflight, /\bINSERT\b|\bDELETE\b|\bTRUNCATE\b/i);
});
