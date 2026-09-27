import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260927211500_p3_7b_company_profile_structured_editing.sql", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/network/manage/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);

test("P3.7B exposes governed mutations for every structured profile section", () => {
  for (const rpc of [
    "p3_7b_set_role",
    "p3_7b_set_subtype",
    "p3_7b_set_product",
    "p3_7b_upsert_facility",
    "p3_7b_archive_facility",
    "p3_7b_set_facility_capability",
    "p3_7b_set_market",
    "p3_7b_upsert_certification",
    "p3_7b_remove_certification",
  ]) {
    assert.match(migration, new RegExp(rpc));
    assert.match(actions, new RegExp(rpc));
  }
});

test("P3.7B preserves provenance, audit and verification boundaries", () => {
  assert.match(migration, /managed_profile:p3\.7b/);
  assert.match(migration, /company_declared/);
  assert.match(migration, /company_managed/);
  assert.match(migration, /p3_7_record_profile_event_impl/);
  assert.match(migration, /requires Platform review/);
  assert.doesNotMatch(migration, /set verification_status='verified'/);
});

test("P3.7B turns network manage into a structured Company Profile Manager", () => {
  assert.match(page, /Company Profile Manager · P3\.7B/);
  assert.match(page, /Tipologia e posizionamento/);
  assert.match(page, /Prodotti e relazione commerciale/);
  assert.match(page, /Sedi, stabilimenti e capability/);
  assert.match(page, /Mercati e settori serviti/);
  assert.match(page, /Certificazioni/);
  assert.match(page, /Completezza profilo/);
  assert.match(page, /Dichiarato dall'azienda/);
  assert.match(page, /Visualizza profilo pubblico/);
});

test("P3.7B seeds a usable steel-company certification taxonomy", () => {
  assert.match(migration, /iso_9001/);
  assert.match(migration, /ped_2014_68_eu/);
  assert.match(migration, /api_5l/);
  assert.match(migration, /iso_3834_2/);
});
