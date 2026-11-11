import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const file = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const cron = file("../../../supabase/migrations/20261111110000_net_it_auto_hourly_release.sql");
const workflow = file("../../../.github/workflows/net-it-auto2-reviewer.yml");

test("hourly jobs only call the two owner-gated publishers, bounded", () => {
  const jobs = [...cron.matchAll(/\$job\$(.*?)\$job\$/gs)].map((m) => m[1].trim());
  assert.deepEqual(jobs, [
    "select private.net_it_auto1_release(100,false);",
    "select private.net_it_auto3_release(100,false);",
  ]);
  assert.doesNotMatch(cron, /set_policy|set_delegation|enabled\s*=\s*true|net_pipeline1b2_settings/i);
  assert.doesNotMatch(cron, /set local role|service_role/i);
});

test("AUTO2 workflow reaches the database only from main and never publishes", () => {
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /pull_request/);
  const commands = [...workflow.matchAll(/python -m (\S+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(commands)], ["pip", "app.net_it_auto2_reviewer"]);
  assert.doesNotMatch(workflow, /_release|set_policy|DB_URL|DB_PASSWORD|ACCESS_TOKEN/i);
});
