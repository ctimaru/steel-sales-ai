import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/pilot-analytics/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/pilot-analytics/actions.ts", import.meta.url),
  "utf8",
);
const form = fs.readFileSync(
  new URL("../components/human-time-evidence-form.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260925131000_add_pilot_human_evidence_checkpoint.sql", import.meta.url),
  "utf8",
);

test("PA2.37 stores bounded human time evidence without commercial free text", () => {
  assert.match(migration, /create table if not exists public\.pilot_human_evidence/);
  assert.match(migration, /steel_sales_seconds/);
  assert.match(migration, /previous_method_seconds/);
  assert.match(migration, /comparison in \('faster','same','slower'\)/);
  assert.match(migration, /confidence in \('low','medium','high'\)/);
  assert.doesNotMatch(migration, /note text/);
  assert.doesNotMatch(migration, /query text/);
});

test("PA2.37 checkpoint requires both quantitative and human evidence", () => {
  assert.match(migration, /minimum_samples_target',3/);
  assert.match(migration, /minimum_task_types_target',2/);
  assert.match(migration, /checkpoint_ready/);
  assert.match(migration, /pilot_evidence_ready/);
  assert.match(migration, /v_samples,0\)>=3/);
  assert.match(migration, /v_task_types,0\)>=2/);
});

test("PA2.37 public RPCs are invoker wrappers around private helpers", () => {
  assert.match(migration, /public\.p1_record_pilot_human_evidence[\s\S]*security invoker/);
  assert.match(migration, /public\.p1_pilot_checkpoint[\s\S]*security invoker/);
  assert.match(migration, /private\.p1_record_pilot_human_evidence_impl/);
  assert.match(migration, /private\.p1_pilot_checkpoint_impl/);
});

test("PA2.37 UI keeps evidence capture lightweight", () => {
  assert.match(page, /p1_pilot_checkpoint/);
  assert.match(page, /HumanTimeEvidenceForm/);
  assert.match(form, /Tempo con Steel Sales AI/);
  assert.match(form, /Stima con email \/ Excel/);
  assert.match(actions, /p1_record_pilot_human_evidence/);
  assert.match(page, /non come misurazione causale precisa/);
});
