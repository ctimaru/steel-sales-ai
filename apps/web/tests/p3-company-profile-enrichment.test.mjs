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
const selectiveMigration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260927115000_p3_4_selective_enrichment_review.sql",
    import.meta.url,
  ),
  "utf8",
);

test("P3.4 surfaces additive enrichment proposals", () => {
  assert.match(page, /Enrichment ready/);
  assert.match(page, /Facility proposte/);
  assert.match(page, /Capability/);
  assert.match(page, /Mercati/);
  assert.match(page, /Approva selezione/);
  assert.match(lib, /facility_candidates/);
  assert.match(lib, /capability_keys/);
  assert.match(lib, /market_keys/);
});

test("P3.4 review uses a dedicated enrich-existing RPC", () => {
  assert.match(actions, /enrich_existing/);
  assert.match(actions, /p3_enrich_existing_company_discovery_selected/);
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


test("P3.4 selective review requires explicit per-field approval", () => {
  assert.match(page, /Approva facility/);
  assert.match(page, /Approva capability/);
  assert.match(page, /Approva mercati/);
  assert.match(page, /Nessun elemento è preselezionato/);
  assert.match(page, /name="capability_key"/);
  assert.match(page, /name="market_key"/);
  assert.match(actions, /getAll\("capability_key"\)/);
  assert.match(actions, /getAll\("market_key"\)/);
  assert.match(selectiveMigration, /capability was not proposed by crawler/);
  assert.match(selectiveMigration, /market was not proposed by crawler/);
  assert.match(selectiveMigration, /'proposed'/);
  assert.match(selectiveMigration, /'approved'/);
});
