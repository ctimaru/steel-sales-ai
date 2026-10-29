import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const contract = read("../lib/pilot-e3-authorization.ts");
const page = read("../app/(italian)/(platform)/platform/pilot/readiness/page.tsx");
const drill = read("../../../supabase/tools/prod_next1e3_restore_drill.sh");
const sql = read("../../../supabase/tests/prod_next1e3_live_no_go.sql");
const workflow = read("../../../.github/workflows/prod-next1e3-recovery.yml");
const runbook = read("../../../docs/operations/prod-next1e3-recovery-and-pilot-authorization.md");

test("E3 makes every independent production authorization requirement visible and keeps pilot off", () => {
  for (const id of ["database", "storage", "migration", "security", "legal", "operations"]) {
    assert.match(contract, new RegExp('id: "' + id + '"'));
  }
  assert.match(contract, /PILOT_E3_LIVE_AUTHORIZED = false as const/);
  assert.match(page, /requirePlatformSuperadmin\(\)/);
  assert.match(page, /PILOT_E3_RECOVERY_EVIDENCE\.map/);
  assert.match(page, /NO-GO · evidenze da approvare/);
  assert.match(page, /Il ripristino sintetico in CI/);
  assert.doesNotMatch(page, /prod_next1e_activate|enablePilotGate|PILOT_E3_LIVE_AUTHORIZED = true/);
});

test("E3 recovery script cannot target remote data or pass synthetic recovery as real backup", () => {
  assert.match(drill, /readonly HOST=127\.0\.0\.1/);
  assert.match(drill, /readonly PORT=54322/);
  assert.match(drill, /disposable-local-only/);
  assert.match(drill, /pg_dump/);
  assert.match(drill, /pg_restore/);
  assert.match(drill, /EXPECTED.*RESTORED/);
  assert.match(drill, /SYNTHETIC_CI_ONLY/);
  assert.match(drill, /not Supabase Storage restore/);
  assert.doesNotMatch(drill, /supabase link|db push|migration repair|SUPABASE_DB_URL|SUPABASE_ACCESS_TOKEN|service_role/i);
  assert.match(runbook, /Level B/);
  assert.match(runbook, /actual file bytes/);
});

test("E3 workflow runs only local database and read-only live-safe NO-GO assertions", () => {
  assert.match(workflow, /supabase db reset --local/);
  assert.match(workflow, /prod_next1e3_live_no_go\.sql/);
  assert.match(workflow, /prod_next1e3_restore_drill\.sh/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(workflow, /supabase link|supabase db push|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|--prod/);
  assert.match(sql, /begin transaction read only/);
  assert.match(sql, /pg_trigger/);
  assert.match(sql, /rollback;/);
  assert.doesNotMatch(sql, /\b(insert into|update public\.|delete from|truncate)\b/i);
});
