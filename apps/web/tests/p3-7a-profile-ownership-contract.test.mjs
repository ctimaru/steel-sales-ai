import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260927203000_p3_7a_profile_data_ownership_contract.sql", import.meta.url),
  "utf8",
);
const networkLib = fs.readFileSync(
  new URL("../lib/network.ts", import.meta.url),
  "utf8",
);

test("P3.7A freezes company-managed vs Platform-controlled profile ownership", () => {
  assert.match(migration, /canonical_profile_model','single_profile'/);
  assert.match(migration, /company_declared/);
  assert.match(migration, /company_managed/);
  assert.match(migration, /platform_controlled/);
  assert.match(migration, /legal_name/);
  assert.match(migration, /verification_status/);
  assert.match(migration, /verified_facts_cannot_be_silently_overridden/);
});

test("P3.7A adds immutable audit and provenance-preserving managed overview", () => {
  assert.match(migration, /network_profile_management_events/);
  assert.match(migration, /events are immutable/);
  assert.match(migration, /managed_profile:p3\.7a/);
  assert.match(migration, /source_assertion_id/);
  assert.doesNotMatch(migration, /set verification_status='verified'/);
});

test("P3.7A exposes a frontend-ready managed profile state", () => {
  assert.match(networkLib, /ManagedNetworkProfileState/);
  assert.match(networkLib, /p3_7_managed_profile_state/);
  assert.match(networkLib, /completeness/);
  assert.match(networkLib, /taxonomy/);
  assert.match(networkLib, /ownership_type/);
});
