import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workflow = readFileSync(fileURLToPath(new URL("../../../.github/workflows/product-flow1-hosted-acceptance.yml", import.meta.url)), "utf8");
const lines = workflow.split("\n");
const intent = lines.findIndex(line => line.trim() === "id: intent");
assert.ok(intent > 0, "Manual acceptance intent guard must exist");
const run = lines.findIndex((line, index) => index > intent && line.trim() === "run: |");
const scriptLines = [];
for (const line of lines.slice(run + 1)) {
  if (line && !line.startsWith("          ")) break;
  scriptLines.push(line.slice(10));
}
const guard = scriptLines.join("\n");
const preview = guard.match(/ATTESTED_PREVIEW_URL = "([^"]+)"/)?.[1];
const valid = {
  PATH: process.env.PATH,
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  REQUESTED_PROJECT_REF: "lwrrrphakpbjhbzljqhn",
  FLOW1_HOSTED_MODE: "preflight",
  FLOW1_HOSTED_APPROVAL: "FLOW1_HOSTED_READ_ONLY",
  FLOW1_HOSTED_PREVIEW_URL: preview,
};
const executeGuard = overrides => spawnSync("bash", ["-euo", "pipefail", "-c", guard], {
  env: { ...valid, ...overrides }, encoding: "utf8", timeout: 5000,
});

test("attested preview is concrete and only explicitly approved main modes pass", () => {
  assert.match(preview, /^https:\/\/steel-sales-[a-z0-9]+-ctimaru-5113\.vercel\.app$/);
  assert.equal(executeGuard({}).status, 0);
  assert.equal(executeGuard({ FLOW1_HOSTED_MODE: "accept", FLOW1_HOSTED_APPROVAL: "FLOW1_HOSTED_EXISTING_QA_ONLY" }).status, 0);
});

test("execution guard rejects other branches, events, targets, previews and mismatched intent", () => {
  for (const invalid of [
    { GITHUB_REF: "refs/heads/test/product-flow1-hosted-acceptance" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { REQUESTED_PROJECT_REF: "ecrafjdummcdfycznitx" },
    { FLOW1_HOSTED_MODE: "cleanup" },
    { FLOW1_HOSTED_MODE: "accept" },
    { FLOW1_HOSTED_APPROVAL: "FLOW1_HOSTED_EXISTING_QA_ONLY" },
    { FLOW1_HOSTED_PREVIEW_URL: "https://steel-sales-unattested-ctimaru-5113.vercel.app" },
    { FLOW1_HOSTED_PREVIEW_URL: preview + "/" },
    { FLOW1_HOSTED_PREVIEW_URL: preview + "@example.test" },
    { FLOW1_HOSTED_PREVIEW_URL: "$(touch /tmp/flow1-hosted-must-not-execute)" },
  ]) assert.notEqual(executeGuard(invalid).status, 0, "Unsafe hosted run must fail before database access");
});

test("manual workflow serializes hosted QA and cleans only successfully seeded application fixtures", () => {
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule):/m);
  assert.match(workflow, /group: staging-ready2b-hosted-qa\n  cancel-in-progress: false/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /if: always\(\) && steps\.target\.outcome == 'success' && steps\.seed\.outcome == 'success'/);
  assert.match(workflow, /-f "\$RUNNER_TEMP\/flow1-hosted-baseline\.psql" \\\n\s+-f supabase\/tests\/product_flow1_hosted_cleanup\.sql/);
  assert.equal((workflow.match(/STAGING_READY2B_AUTH_SECRET_KEY: \$\{\{ secrets\.STAGING_READY2B_AUTH_SECRET_KEY \}\}/g) ?? []).length, 1,
    "Admin Auth credential belongs only to the acceptance browser step");
  const targetStart = workflow.indexOf("- name: Verify protected staging database target");
  const targetBlock = workflow.slice(targetStart, workflow.indexOf("      - uses:", targetStart));
  assert.match(targetBlock, /staging-ready1-target-guard\.py[\s\S]*GITHUB_ENV[\s\S]*replace\("%", "%25"\)[\s\S]*print\("::add-mask::" \+ escaped\)/,
    "Normalized database URI must be masked within the target step before later steps receive it");
  assert.doesNotMatch(workflow, /staging-ready2b-fixtures\.mjs|upload-artifact|STAGING_WORKER_INTERNAL_TOKEN|createUser|deleteUser/);
});

test("acceptance checks credential presence before seeding without exposing values to preflight", () => {
  const readiness = workflow.indexOf("- name: Verify acceptance credentials exist before creating fixtures");
  const seed = workflow.indexOf("- name: Seed only isolated application fixtures");
  assert.ok(readiness > 0 && readiness < seed);
  const readinessBlock = workflow.slice(readiness, workflow.indexOf("      - name:", readiness + 1));
  assert.match(readinessBlock, /if: inputs\.mode == 'accept'/);
  for (const key of ["FLOW1_AUTH_KEY_PRESENT", "FLOW1_PUBLIC_KEY_PRESENT", "FLOW1_VERCEL_BYPASS_PRESENT"])
    assert.ok(readinessBlock.includes('test "$' + key + '" = "true"'));
  assert.doesNotMatch(readinessBlock, /AUTH_SECRET_KEY:|UI4_VERCEL_BYPASS:|PUBLISHABLE_KEY:/);
});
