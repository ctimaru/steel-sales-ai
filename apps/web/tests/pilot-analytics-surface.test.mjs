import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/pilot-analytics/page.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260925124500_add_pilot_exit_readiness.sql", import.meta.url),
  "utf8",
);

test("PA2.35 exposes the pilot analytics surface and read models", () => {
  assert.match(shell, /href: "\/pilot-analytics"/);
  assert.match(shell, /Pilot analytics/);
  assert.match(page, /p1_pilot_usage_summary/);
  assert.match(page, /p1_pilot_exit_readiness/);
  assert.match(page, /P1\.12 · Pilot Analytics/);
});

test("PA2.35 readiness criteria are explicit and measurable", () => {
  assert.match(migration, /'target',3/);
  assert.match(migration, /'target',10/);
  assert.match(migration, /'target',0\.70/);
  assert.match(migration, /'target',4/);
  assert.match(migration, /'target',1/);
  assert.match(migration, /pilot_evidence_ready/);
  assert.match(page, /Tempo umano per trovare un'informazione/);
});

test("PA2.35 public readiness RPC is security invoker over a private helper", () => {
  assert.match(migration, /private\.p1_pilot_exit_readiness_impl/);
  assert.match(migration, /public\.p1_pilot_exit_readiness[\s\S]*security invoker/);
  assert.match(migration, /active tenant membership required/);
});
