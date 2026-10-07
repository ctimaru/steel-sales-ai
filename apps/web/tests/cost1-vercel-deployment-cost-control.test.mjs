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
