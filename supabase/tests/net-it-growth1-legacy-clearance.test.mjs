// NET-IT-GROWTH1 contract: the legacy identity hold is cleared only by v2
// first-party evidence; every other AUTO3/PA1.5 gate stays exactly as before.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const file = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const base = file("../migrations/20261110183000_net_it_auto3_facts_only_release.sql");
const sql = file("../migrations/20261111170000_net_it_growth1_legacy_identity_clearance.sql");
const worker = file("../../services/worker/app/net_it_auto2_reviewer.py");

test("release query: legacy hold requires v2 evidence, sole trader still blocked", () => {
  assert.match(sql, /'legal_identity_not_verified'\]::text\[\]\n\s+OR e\.reviewer_version='net-it-auto2-firstparty-v2'\)/);
  assert.match(sql, /v_candidate\.quality_flags && ARRAY\['historical_sole_trader_vat_context'\]::text\[\]/);
  assert.match(sql, /AND v_evidence\.reviewer_version<>'net-it-auto2-firstparty-v2'\)/);
  assert.doesNotMatch(sql, /&& ARRAY\['legal_identity_not_verified','historical_sole_trader_vat_context'\]/);
});

test("PA1.5 guard: legacy hold requires v2 evidence; v1 and v2 are the only versions", () => {
  assert.match(sql, /NEW\.quality_flags\n\s+&& ARRAY\['historical_sole_trader_vat_context'\]::text\[\]/);
  assert.match(sql, /OR \(NEW\.quality_flags @> ARRAY\['legal_identity_not_verified'\]::text\[\]\n\s+AND v_ev\.reviewer_version<>'net-it-auto2-firstparty-v2'\)/);
  assert.equal((sql.match(/NOT IN \('net-it-auto2-firstparty-v1','net-it-auto2-firstparty-v2'\)/g) || []).length, 2);
});

test("unchanged gates: legal form, ' di ', confidence, freshness, maintenance-only agent", () => {
  const forms = (s) => [...s.matchAll(/legal_name (?:!~\*|~\*) '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(forms(sql), forms(base));
  for (const needle of [
    "LIKE '% di %'", "identity_confidence>=0.94", "interval '3 days'",
    "session_user<>'postgres' OR auth.uid() IS NOT NULL",
    "FROM PUBLIC,anon,authenticated,service_role",
    "NOT EXISTS(\n      SELECT 1 FROM public.network_netfast3_suppressed_domains s",
  ]) assert.ok(sql.includes(needle), needle);
});

test("migration only redefines the two functions it declares", () => {
  const defs = [...sql.matchAll(/CREATE OR REPLACE FUNCTION ([\w.]+)\(/g)].map((m) => m[1]);
  assert.deepEqual(defs, ["private.net_it_auto3_release", "private.pa1_5_discovery_publication_guard"]);
  assert.doesNotMatch(sql, /GRANT EXECUTE|DROP TRIGGER|DISABLE TRIGGER|ALTER TABLE/);
});

test("worker v2 reads legal/contact pages and drops the legacy-hold reason", () => {
  assert.match(worker, /VERSION = "net-it-auto2-firstparty-v2"/);
  assert.match(worker, /IDENTITY_PATH_HINTS = \(/);
  assert.doesNotMatch(worker, /existing_legal_identity_hold/);
  assert.match(worker, /sole_trader_identity_exception/);
  assert.match(worker, /legal_form_requires_human_review/);
});
