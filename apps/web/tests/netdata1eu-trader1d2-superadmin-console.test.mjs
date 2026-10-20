import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
const migration = read("../../../supabase/migrations/20261020212500_trader1d2_superadmin_review_console.sql");
const route = read("../app/(italian)/(platform)/platform/company-discovery/trader-verification/page.tsx");
const action = read("../app/(italian)/(platform)/platform/company-discovery/trader-verification/actions.ts");
const nav = read("../lib/platform-ia-contract.ts");
const hp13 = read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");

test("TRADER1D.2 is a real superadmin-only private research read/write bridge", () => {
  assert.match(route,/requirePlatformSuperadmin\(\)/);
  assert.match(action,/requirePlatformSuperadmin\(\)/);
  assert.match(migration,/pur\.role='platform_superadmin' AND pur\.status='active'/);
  assert.match(migration,/pur\.role = 'platform_superadmin' AND pur\.status = 'active'/);
  assert.match(migration,/\(SELECT auth\.uid\(\)\) IS NULL/);
  assert.match(migration,/SECURITY DEFINER SET search_path = ''/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.trader1d2_superadmin_queue/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.trader1d2_record_decision/);
  assert.match(migration,/FROM PUBLIC,anon,authenticated/);
  assert.match(migration,/TO authenticated,service_role/);
  assert.doesNotMatch(migration,/GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON private\./i);
  assert.match(hp13,/'trader1d2_superadmin_queue'/);
  assert.match(hp13,/'trader1d2_record_decision'/);
});

test("TRADER1D.2 preserves independent evidence dimensions, source rights and immutable decisions", () => {
  for(const dimension of [
    "legal_identity","trader_role","product_evidence","domain_reconciliation",
    "reuse_rights","facility_source",
  ]) assert.ok(migration.includes("'"+dimension+"'"));
  assert.match(migration,/INSERT INTO private\.netdata1eu_trader_review_decisions/);
  assert.match(migration,/reviewer_id/);
  assert.match(migration,/\(SELECT auth\.uid\(\)\)/);
  assert.match(migration,/p_note IS NULL OR length\(btrim\(p_note\)\) NOT BETWEEN 20 AND 800/);
  assert.match(migration,/p_decision='accepted'/);
  assert.match(migration,/permission_basis/);
  assert.match(migration,/permission_scope/);
  assert.match(route,/storico|Storico decisioni/);
  assert.match(route,/non verifica/);
  assert.match(route,/non pubblica/);
  assert.doesNotMatch(migration,/INSERT INTO public\.network_companies|UPDATE public\.network_companies|INSERT INTO public\.network_facilities|UPDATE public\.network_facilities/i);
});

test("TRADER1D.2 fails closed when migration unavailable and lives only in owner menu", () => {
  assert.match(route,/value\?\.contract === "trader1d2-superadmin-v1"/);
  assert.match(route,/Console non ancora attiva/);
  assert.match(route,/issue[s]?\/771/);
  assert.match(route,/25/);
  assert.match(nav,/key: "traderVerification"/);
  assert.match(nav,/access: \{ kind: "owner_only" \}/);
  assert.match(nav,/path: "\/platform\/company-discovery\/trader-verification"/);
  assert.match(action,/revalidatePath\("\/platform\/company-discovery\/trader-verification"\)/);
});
