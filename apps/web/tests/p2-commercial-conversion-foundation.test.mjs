import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/commercial/conversion/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/commercial/conversion/actions.ts", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260926191000_p2_commercial_conversion_foundation.sql", import.meta.url),
  "utf8",
);

test("P2.5 exposes a canonical Commercial Intelligence conversion workspace", () => {
  assert.match(routes, /conversion:\s*"\/commercial\/conversion"/);
  assert.match(shell, /Esiti & conversione/);
  assert.match(page, /Esiti & conversione/);
  assert.match(actions, /p2_commercial_conversion_foundation/);
});

test("P2.5 UI makes conversion coverage-first and nullable", () => {
  assert.match(page, /Coverage prima del funnel/);
  assert.match(page, /Identity gap/);
  assert.match(page, /Relationship gap/);
  assert.match(page, /N\/D/);
  assert.match(page, /non entrano automaticamente nel funnel di conversione/);
});

test("P2.5 contract rejects weak evidence and predictive scoring", () => {
  assert.match(migration, /missing_identity_is_not_loss',true/);
  assert.match(migration, /missing_relationship_is_not_loss',true/);
  assert.match(migration, /predictive_score',false/);
  assert.match(migration, /cross_thread_similarity',false/);
  assert.match(migration, /email_domain_inference',false/);
  assert.match(migration, /filename_inference',false/);
  assert.match(migration, /subject_inference',false/);
});

test("P2.5 conversion rate is null without deterministic denominator", () => {
  assert.match(migration, /when \(select count\(\*\) from eligible_offers\)=0 then null/);
  assert.match(migration, /verified_company_plus_same_company_rfq_link/);
});

test("P2.5 reconciliation requires convergent verified Company sources", () => {
  assert.match(migration, /source_company_count=1/);
  assert.match(migration, /commercial_company_identity_verifications/);
  assert.match(migration, /offer_source_conflicts/);
  assert.match(migration, /order_source_conflicts/);
});
