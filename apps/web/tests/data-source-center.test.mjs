import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/data-sources/actions.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/data-sources/page.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("data source center derives actor identity server-side and calls trusted worker", () => {
  assert.match(actions, /supabase\.auth\.getClaims\(\)/);
  assert.match(actions, /actor_user_id: actorUserId/);
  assert.match(actions, /\/v1\/data-sources\/history/);
  assert.match(actions, /WORKER_INTERNAL_TOKEN/);
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("data source center exposes required P1.3 operational states", () => {
  assert.match(page, /Indicizzati/);
  assert.match(page, /Duplicati/);
  assert.match(page, /Errori \/ scartati/);
  assert.match(page, /Ultimo sync/);
  assert.match(page, /Import history/);
  assert.match(page, /File ed email storici e nuovi batch P1\.2/);
});

test("workspace navigation links source history and import workflow", () => {
  assert.match(shell, /href: "\/data-sources"/);
  assert.match(shell, /href: "\/uploads"/);
  assert.match(page, /href="\/uploads"/);
});
