import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(platform)/platform/company-discovery/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(platform)/platform/company-discovery/actions.ts", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/platform-shell.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260926223500_p3_web_company_discovery.sql", import.meta.url),
  "utf8",
);

test("P3.2 exposes Company Discovery only in Platform control plane", () => {
  assert.match(shell, /\/platform\/company-discovery/);
  assert.match(page, /Company Discovery/);
  assert.match(page, /Pubblica nuovo profilo/);
  assert.match(page, /Segna duplicato/);
  assert.match(page, /Rifiuta/);
});

test("P3.2 discovery action queues crawler work through protected worker boundary", () => {
  assert.match(actions, /p3_start_company_discovery/);
  assert.match(actions, /WORKER_URL/);
  assert.match(actions, /WORKER_INTERNAL_TOKEN/);
  assert.match(actions, /x-worker-token/);
  assert.match(actions, /\/v1\/network\/discovery\/crawl/);
});

test("P3.2 promotion remains explicit and separates claim from verification", () => {
  assert.match(actions, /p3_review_company_discovery/);
  assert.match(migration, /'published','unclaimed','unverified'/);
  assert.match(migration, /duplicate_existing/);
  assert.match(migration, /merge_performed',false/);
  assert.match(migration, /existing Network identity match requires duplicate_existing/);
});

test("P3.2 raw discovery staging is not granted to authenticated users", () => {
  assert.match(
    migration,
    /revoke all on table public\.network_company_discovery_runs from public,anon,authenticated/,
  );
  assert.match(
    migration,
    /revoke all on table public\.network_company_discovery_candidates from public,anon,authenticated/,
  );
});
