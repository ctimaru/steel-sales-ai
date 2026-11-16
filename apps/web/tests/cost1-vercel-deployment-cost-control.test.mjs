import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const config = JSON.parse(
  fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);

test("COST1 deploys main and explicit preview branches only", () => {
  assert.deepEqual(config.git?.deploymentEnabled, {
    "*": false,
    main: true,
    "preview-*": true,
  });
});

test("COST1 keeps ignored-build protection for non-web changes", () => {
  assert.equal(config.ignoreCommand, "git diff --quiet HEAD^ HEAD -- .");
});

test("PERF-REGION1 runs functions in Paris (cdg1), next to the Supabase database (eu-west-3)", () => {
  // Founder decision, 16 Nov 2026: functions were in iad1 (Washington), so every
  // database round trip crossed the Atlantic.
  assert.deepEqual(config.regions, ["cdg1"]);
});
