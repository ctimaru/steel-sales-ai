import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/commercial/conversion/relationships/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/commercial/conversion/relationships/actions.ts", import.meta.url),
  "utf8",
);
const form = fs.readFileSync(
  new URL("../components/cross-thread-decision-form.tsx", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260926210500_p2_cross_thread_relationship_evidence.sql", import.meta.url),
  "utf8",
);

test("P2.6 exposes canonical cross-thread review workspace", () => {
  assert.match(routes, /crossThreadRelationships:\s*"\/commercial\/conversion\/relationships"/);
  assert.match(shell, /Relazioni cross-thread/);
  assert.match(page, /Relazioni cross-thread/);
  assert.match(actions, /p2_cross_thread_relationship_evidence/);
});

test("P2.6 requires explicit human accept or reject", () => {
  assert.match(form, /Accetta relazione/);
  assert.match(form, /Rifiuta candidato/);
  assert.match(actions, /p2_decide_cross_thread_relationship/);
  assert.match(page, /Strong review non significa relazione confermata/);
});

test("P2.6 excludes weak inference channels", () => {
  assert.match(migration, /automatic_activation',false/);
  assert.match(migration, /email_domain_inference',false/);
  assert.match(migration, /filename_inference',false/);
  assert.match(migration, /subject_similarity',false/);
  assert.match(migration, /embedding_similarity',false/);
  assert.match(migration, /fuzzy_dimension_tolerance',false/);
});

test("P2.6 preserves geometry evidence without geometry-only line mutation", () => {
  assert.match(migration, /geometry_only_line_fk',false/);
  assert.match(migration, /human_confirmed_cross_thread_evidence/);
  assert.match(page, /nessun link geometrico automatico/);
});

test("P2.6 decisions are audit-backed and conversion-aware", () => {
  assert.match(migration, /commercial_relationship_evidence_decisions/);
  assert.match(migration, /p2_reconcile_commercial_outcome_attribution_impl/);
  assert.match(actions, /conversion intelligence è stata aggiornata/);
});
