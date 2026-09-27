import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260927232000_p3_7e_product_scope_marketplace_readiness.sql", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const manage = fs.readFileSync(
  new URL("../app/(workspace)/network/manage/page.tsx", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const network = fs.readFileSync(
  new URL("../lib/network.ts", import.meta.url),
  "utf8",
);

test("P3.7E reuses canonical Steel Knowledge instead of duplicating technical masters", () => {
  assert.match(migration, /references public\.steel_standards/);
  assert.match(migration, /references public\.steel_material_grades/);
  assert.match(migration, /steel_standard_product_families/);
  assert.match(migration, /steel_standard_grade_applicability/);
  assert.match(migration, /steel_standard_grades/);
  assert.match(migration, /tubes_pipes','round_tube/);
  assert.match(migration, /hollow_sections','square_tube/);
  assert.doesNotMatch(migration, /create table if not exists public\.network_steel_standards/);
  assert.doesNotMatch(migration, /create table if not exists public\.network_material_grades/);
});

test("P3.7E governs standards, grades and dimensional envelopes", () => {
  for (const rpc of [
    "p3_7e_set_product_standard",
    "p3_7e_set_product_grade",
    "p3_7e_upsert_product_dimension",
    "p3_7e_remove_product_dimension",
    "p3_7e_managed_product_scope",
    "p3_7e_public_product_scope",
  ]) {
    assert.match(migration, new RegExp(rpc));
    assert.match(actions + network, new RegExp(rpc));
  }

  assert.match(migration, /managed_profile:p3\.7e/);
  assert.match(migration, /company_declared/);
  assert.match(migration, /company_managed/);
  assert.match(migration, /remove technical product scope before removing product relationship/);
  assert.match(migration, /verified standard scope requires Platform review/);
  assert.match(migration, /verified grade scope requires Platform review/);
  assert.match(migration, /verified dimension scope requires Platform review/);
});

test("P3.7E Company Profile Manager exposes matching-ready technical product scope", () => {
  assert.match(manage, /Prodotti e scope tecnico/);
  assert.match(manage, /Technical \/ Marketplace scope/);
  assert.match(manage, /Norme/);
  assert.match(manage, /Gradi \/ materiali/);
  assert.match(manage, /Range dimensionali/);
  assert.match(manage, /Rimuovi prima norme, gradi e range tecnici/);
  assert.match(actions, /setManagedProductStandardScope/);
  assert.match(actions, /setManagedProductGradeScope/);
  assert.match(actions, /upsertManagedProductDimensionScope/);
  assert.match(actions, /removeManagedProductDimensionScope/);
});

test("P3.7E public Company Profile presents scope without claiming verification", () => {
  assert.match(network, /technical_scope: PublicProductTechnicalScope/);
  assert.match(network, /p3_7e_public_product_scope/);
  assert.match(profile, /Technical scope/);
  assert.match(profile, /Range dichiarati/);
  assert.match(profile, /Lo scope tecnico indica ciò che l&apos;azienda dichiara di trattare/);
  assert.match(profile, /VerificationBadge status=\{standard\.verification_status\}/);
  assert.match(profile, /ProvenanceBadge kind=\{standard\.provenance_kind\}/);
});
