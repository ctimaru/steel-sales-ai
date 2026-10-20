import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261020212500_trader1d2_superadmin_review_console.sql");
const route = read("../app/(italian)/(platform)/platform/company-discovery/trader-verification/page.tsx");
const action = read("../app/(italian)/(platform)/platform/company-discovery/trader-verification/actions.ts");
const nav = read("../lib/platform-ia-contract.ts");
const hp13 = read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");

test("TRADER1D.2 retains owner-only source read and historic SQL guards", () => {
  assert.match(route,/requirePlatformSuperadmin\(\)/);
  assert.match(action,/requirePlatformSuperadmin\(\)/);
  assert.match(migration,/pur\.role='platform_superadmin' AND pur\.status='active'/);
  assert.match(migration,/pur\.role = 'platform_superadmin' AND pur\.status = 'active'/);
  assert.match(migration,/SECURITY DEFINER SET search_path = ''/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.trader1d2_superadmin_queue/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.trader1d2_record_decision/);
  assert.match(hp13,/'trader1d2_superadmin_queue'/);
  assert.match(hp13,/'trader1d2_record_decision'/);
});

test("TRADER1D.3A removes manual verification and fails closed on cached submit", () => {
  assert.match(route,/Qualità automatica/);
  assert.match(route,/firstPartyEvidence/);
  assert.match(route,/domain_collision_count/);
  assert.match(route,/publicationBlocked/);
  assert.match(route,/license_approved/);
  assert.match(route,/network\/start/);
  assert.doesNotMatch(route,/<form action=\{recordTraderReview\}/);
  assert.doesNotMatch(route,/Accetta evidenza|Registra una decisione|6\/6/);
  assert.match(action,/throw new Error\("Revisione manuale commercianti disattivata/);
  assert.doesNotMatch(action,/supabase\.rpc\("trader1d2_record_decision"/);
  assert.match(route,/non certificano un&apos;azienda/);
  assert.match(route,/senza visita in tempo reale/);
});

test("TRADER1D.3A quality is informative, source-rights remain separate, owner menu preserved", () => {
  assert.match(route,/source_rights/);
  assert.match(route,/Una fonte ufficiale non costituisce/);
  assert.match(route,/il claim del profilo/);
  assert.match(route,/value\?\.contract === "trader1d2-superadmin-v1"/);
  assert.match(route,/Dati non disponibili/);
  assert.match(route,/issue[s]?\/780/);
  assert.match(nav,/key: "traderVerification"/);
  assert.match(nav,/label: "Qualità automatica UE"/);
  assert.match(nav,/access: \{ kind: "owner_only" \}/);
  assert.match(nav,/path: "\/platform\/company-discovery\/trader-verification"/);
  assert.doesNotMatch(migration,/INSERT INTO public\.network_companies|UPDATE public\.network_companies|INSERT INTO public\.network_facilities|UPDATE public\.network_facilities/i);
});
