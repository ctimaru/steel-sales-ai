import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../app/(italian)/(platform)/platform/network-trust/source-rights/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../app/(italian)/(platform)/platform/network-trust/source-rights/rights-decision-form.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/(italian)/(platform)/platform/network-trust/source-rights/actions.ts", import.meta.url), "utf8");

test("TRUST-C2G3: the owner console reads via the guarded RPC, never the private ledger directly", () => {
  assert.match(page, /requirePlatformSuperadmin\(\)/);
  assert.match(page, /rpc\("trust_c2g3_rights_console"/);
  assert.doesNotMatch(page, /service_role|SUPABASE_SECRET_KEY|\.from\("trust_c2g2_rights_decisions"\)/);
});

test("TRUST-C2G3: form records only a user-authenticated, server-reviewed decision", () => {
  assert.match(actions, /requirePlatformSuperadmin\(\)/);
  assert.match(actions, /auth\.getUser\(\)/);
  assert.match(actions, /rpc\("trust_c2g3_record_rights_decision"/);
  assert.match(actions, /p_expected_decision_id/);
  assert.match(actions, /p_evidence_url/);
  assert.match(form, /ConfirmSubmitButton/);
  assert.match(form, /hasHold/);
});

test("TRUST-C2G3: the source-use review includes all seven distinct scopes without product enablement", () => {
  for (const scope of ["discovery","factual_profile","excerpt_republication","ai_retrieval",
     "ai_training","bulk_redistribution","paid_network"]) {
    assert.ok(page.includes(scope), scope);
  }
  assert.doesNotMatch(page + form + actions, /process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)/);
});
