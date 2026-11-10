import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (url) => readFileSync(fileURLToPath(new URL(url, import.meta.url)), "utf8");

const sql = read("../../../supabase/migrations/20261109141131_founder_decision_history_read.sql");
const loader = read("../lib/founder-decision-history.ts");
const page = read("../app/(italian)/(platform)/platform/decisions/page.tsx");

test("founder decision history is a guarded read-only audit projection", () => {
  assert.match(sql, /private\.sss_founder_decision_history_read/);
  assert.match(sql, /security definer[\s\S]*?set search_path = ''/);
  assert.match(sql, /v_actor is null or not coalesce\(private\.is_platform_superadmin\(\), false\)/);
  assert.match(sql, /public\.sss_founder_decision_history_read/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /revoke all on function public\.sss_founder_decision_history_read[\s\S]*?from public, anon/);
  assert.match(sql, /grant execute on function public\.sss_founder_decision_history_read[\s\S]*?to authenticated/);
  assert.doesNotMatch(sql, /grant\s+select\s+on\s+public\.platform_access_events/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+public\.platform_access_events\b/i);
});

test("historical entries are only committed, decision-like operations; never RFQ private content", () => {
  for (const action of [
    "registration_application_approved", "registration_workspace_activated",
    "company_claim_proof_verified", "company_claim_approved", "company_claim_revoked",
    "discovery_candidate_published", "discovery_exact_duplicates_closed",
    "network_verification_verified",
  ]) {
    assert.ok(sql.includes("'" + action + "'"), action);
    assert.ok(loader.includes(action), action);
  }
  assert.doesNotMatch(sql, /'staff_invitation_accepted'|'application_created'|'network_assertion_created'/);
  assert.doesNotMatch(sql, /e\.metadata|e\.before_state|e\.after_state|e\.target_organization_id/);
  assert.match(sql, /from public\.platform_access_events e/);
});

test("keyset pagination uses a bounded page size and a stable timestamp plus UUID", () => {
  assert.match(sql, /least\(50, greatest\(1, coalesce\(p_limit, 20\)\)\)/);
  assert.match(sql, /e\.occurred_at, e\.id\) < \(p_before_at, p_before_id\)/);
  assert.match(sql, /order by e\.occurred_at desc, e\.id desc/);
  assert.match(sql, /limit v_limit \+ 1/);
  assert.match(loader, /p_before_at: before\?\.at \?\? null/);
  assert.match(loader, /p_before_id: before\?\.id \?\? null/);
  assert.match(page, /Mostra decisioni precedenti/);
});

test("owner-only page displays verified dates, effects and operational links without actions", () => {
  assert.match(page, /if \(!context\.is_platform_owner\) notFound\(\)/);
  assert.match(page, /getFounderDecisionHistory\(cursor\)/);
  assert.match(page, /Storico delle decisioni/);
  assert.match(page, /entry\.effect/);
  assert.match(page, /entry\.href/);
  assert.match(page, /entry\.at/);
  assert.match(page, /history\.status === "unavailable"/);
  assert.match(loader, /Fail closed on unexpected audit event formats/);
  assert.match(loader, /uuidPattern\.test\(item\.entity_id\)/);
  assert.doesNotMatch(page, /<form|<button|\.insert\(|\.update\(|\.delete\(/);
});
