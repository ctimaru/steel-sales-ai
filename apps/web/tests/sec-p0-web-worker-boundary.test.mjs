import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.resolve("app/(italian)/(workspace)/search/actions.ts"),"utf8");

test("global search server action authenticates before contacting private Worker", () => {
  assert.match(source,/^"use server";/);
  const claims = source.indexOf("supabase.auth.getClaims()");
  const identity = source.indexOf("data?.claims?.sub");
  const deny = source.indexOf('if (!actorUserId)');
  const endpoint = source.indexOf('fetch(`${workerUrl}/v1/global-search`');
  assert.ok(claims >= 0 && identity > claims && deny > identity && endpoint > deny);
  assert.match(source,/actor_user_id: actorUserId/);
  assert.doesNotMatch(source,/actor_user_id:\s*(?:text\(formData|formData\.get)/);
  assert.match(source,/process\.env\.WORKER_INTERNAL_TOKEN/);
  assert.match(source,/headers\["x-worker-token"\] = process\.env\.WORKER_INTERNAL_TOKEN/);
  assert.match(source,/cache: "no-store"/);
});

test("global search does not use browser-visible worker credential", () => {
  assert.doesNotMatch(source,/NEXT_PUBLIC_WORKER_INTERNAL_TOKEN/);
  assert.doesNotMatch(source,/NEXT_PUBLIC_WORKER_URL/);
});
