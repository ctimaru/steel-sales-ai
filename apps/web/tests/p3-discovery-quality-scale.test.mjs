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
  new URL("../../../supabase/migrations/20260926230500_p3_discovery_quality_scale.sql", import.meta.url),
  "utf8",
);

test("P3.3 surfaces extraction quality and batch telemetry", () => {
  assert.match(page, /Con quality flags/);
  assert.match(page, /Exact identity match/);
  assert.match(page, /Ultimo run/);
  assert.match(page, /classification_scores/);
  assert.match(lib, /identity_quality/);
  assert.match(lib, /quality_flags/);
  assert.match(lib, /p3_admin_discovery_runs/);
});

test("P3.3 adds only explicit bulk closure for exact duplicates", () => {
  assert.match(page, /Chiudi .* exact match/);
  assert.match(actions, /p3_close_exact_discovery_duplicates/);
  assert.match(migration, /website_domain_exact/);
  assert.match(migration, /country_vat_exact/);
  assert.match(migration, /merge_performed',false/);
  assert.doesNotMatch(migration, /review_status='published'.*match_signals/s);
});

test("P3.3 labels discovery source batches", () => {
  assert.match(actions, /p3_start_company_discovery_batch/);
  assert.match(migration, /web_search_curated/);
  assert.match(migration, /industry_directory/);
  assert.match(migration, /association/);
  assert.match(migration, /extraction_version/);
});
