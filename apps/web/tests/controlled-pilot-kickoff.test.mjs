import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/pilot-analytics/page.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260925130000_add_controlled_pilot_runs.sql", import.meta.url),
  "utf8",
);

test("PA2.36 defines one active controlled pilot per organization", () => {
  assert.match(migration, /create table if not exists public\.pilot_runs/);
  assert.match(migration, /where status='active'/);
  assert.match(migration, /unique index if not exists pilot_runs_one_active_per_org_idx/);
  assert.match(migration, /baseline_event_count/);
  assert.match(migration, /protocol_version/);
});

test("PA2.36 keeps the public pilot RPC tenant-safe", () => {
  assert.match(migration, /private\.p1_active_pilot_run_impl/);
  assert.match(migration, /public\.p1_active_pilot_run[\s\S]*security invoker/);
  assert.match(migration, /active tenant membership required/);
  assert.match(migration, /revoke all on table public\.pilot_runs from public, anon, authenticated/);
});

test("PA2.36 anchors analytics to the kickoff timestamp", () => {
  assert.match(page, /p1_active_pilot_run/);
  assert.match(page, /const sincePilot = pilot\.started_at/);
  assert.match(page, /p_since: sincePilot/);
  assert.match(page, /Pilot controllato attivo/);
  assert.match(page, /non vengono inseriti eventi sintetici/);
  assert.match(page, /Non inseguire i KPI/);
});
