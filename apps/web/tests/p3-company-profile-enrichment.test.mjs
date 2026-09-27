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
const lib = fs.readFileSync(
  new URL("../lib/company-discovery.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260927103000_p3_4_company_profile_enrichment.sql",
    import.meta.url,
  ),
  "utf8",
);

test("P3.4 surfaces additive enrichment proposals", () => {
  assert.match(page, /Enrichment ready/);
  assert.match(page, /Facility proposte/);
  assert.match(page, /Capability/);
  assert.match(page, /Mercati/);
  assert.match(page, /Arricchisci profilo esistente/);
  assert.match(lib, /facility_candidates/);
  assert.match(lib, /capability_keys/);
  assert.match(lib, /market_keys/);
});

test("P3.4 review uses a dedicated enrich-existing RPC", () => {
  assert.match(actions, /enrich_existing/);
  assert.match(actions, /p3_enrich_existing_company_discovery/);
  assert.match(migration, /hard exact identity match required for enrichment/);
  assert.match(migration, /company_fields_overwritten',false/);
  assert.match(migration, /merge_performed',false/);
});

test("P3.4 bulk duplicate closure preserves useful enrichment", () => {
  assert.match(page, /exact match senza enrichment/);
  assert.match(migration, /enrichment_candidates_preserved',true/);
  assert.match(migration, /jsonb_array_length\(c\.facility_candidates\)=0/);
  assert.match(migration, /cardinality\(c\.capability_keys\)=0/);
  assert.match(migration, /cardinality\(c\.market_keys\)=0/);
});
