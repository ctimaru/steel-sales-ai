import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const action = readFileSync(new URL("../app/(italian)/(workspace)/search/actions.ts",import.meta.url),"utf8");

test("SEC-P0-CLOSE1D.3 uses server-verified JWT subject as Worker actor", () => {
  assert.match(action,/supabase\.auth\.getClaims\(\)/);
  assert.match(action,/const actorUserId = typeof data\?\.claims\?\.sub === "string" \? data\.claims\.sub : null/);
  assert.match(action,/if \(!actorUserId\)/);
  assert.match(action,/actor_user_id: actorUserId/);
  assert.doesNotMatch(action,/actor_user_id:\s*(?:text\(formData|formData\.get)/);
  assert.doesNotMatch(action,/owner_id:\s*(?:text\(formData|formData\.get)/);
});

test("SEC-P0-CLOSE1D.3 requires internal service token for privileged search", () => {
  assert.match(action,/headers\["x-worker-token"\] = process\.env\.WORKER_INTERNAL_TOKEN/);
  assert.match(action,/cache: "no-store"/);
});
