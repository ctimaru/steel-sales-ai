import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const model = read("../lib/company-verification-model.ts");
const loader = read("../lib/company-verification.ts");
const action = read("../app/(italian)/(workspace)/dashboard/verification-actions.ts");
const card = read("../components/company-verification-card.tsx");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const migration = read("../../../supabase/migrations/20261104120000_selfver1_company_verification_badge.sql");
const gate = read("../../../.github/workflows/p0-required-gate.yml");

const compiled = ts.transpileModule(model, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox);
const m = sandbox.exports;

const payload = (extra = {}) => ({ contract: "selfver1-state-v1", has_company: true, verification_status: "unverified", reasons: [], ...extra });

test("SELFVER1 parses only the governed state contract", () => {
  assert.equal(m.parseCompanyVerificationState(null), null);
  assert.equal(m.parseCompanyVerificationState({ contract: "other" }), null);
  assert.equal(m.parseCompanyVerificationState(payload({ has_company: false })), null);
  assert.equal(m.parseCompanyVerificationState(payload({ verification_status: "bogus" })), null);
  const s = m.parseCompanyVerificationState(payload({ method: "automatic_domain", verification_status: "verified", auto_eligible: true }));
  assert.equal(s.status, "verified");
  assert.equal(s.method, "automatic_domain");
  assert.equal(s.autoEligible, true);
});

test("SELFVER1 explains reasons in Italian and drops unknown codes", () => {
  const copy = m.verificationReasonCopy(["generic_email_domain", "zzz", "generic_email_domain", "vat_invalid"]);
  assert.equal(copy.length, 2);
  assert.match(copy[0], /email personale o PEC/);
});

test("SELFVER1 manual request only for admins, when staff has not decided and none is pending", () => {
  const base = m.parseCompanyVerificationState(payload({ reasons: ["generic_email_domain"] }));
  assert.equal(m.canRequestManualVerification(base, true), true);
  assert.equal(m.canRequestManualVerification(base, false), false);
  assert.equal(m.canRequestManualVerification({ ...base, manualRequestPending: true }, true), false);
  assert.equal(m.canRequestManualVerification({ ...base, status: "revoked", reasons: ["staff_decision"] }, true), false);
  assert.equal(m.canRequestManualVerification({ ...base, status: "verified" }, true), false);
});

test("SELFVER1 Home loads state for the session organization and fails soft", () => {
  assert.match(loader, /^import "server-only";/);
  assert.match(loader, /rpc\("selfver1_my_verification_state", \{ p_organization_id: organizationId \}\)/);
  assert.match(loader, /if \(!state \|\| !state\.autoEligible/);
  assert.match(loader, /rpc\("selfver1_try_auto_verify"/);
  assert.match(loader, /catch \{\s*return null;/);
  assert.match(home, /loadCompanyVerification\(context\.organizationId\)/);
  assert.ok(home.indexOf("<CompanyVerificationCard") < home.indexOf("<WorkspaceFirstRunChecklist"));
  assert.match(card, /if \(!state\) return null;/);
});

test("SELFVER1 manual request is admin-only on both sides", () => {
  assert.match(action, /^"use server";/);
  assert.match(action, /await requireWorkspaceAdmin\("\/dashboard"\)/);
  assert.match(action, /p_organization_id: context\.organizationId/);
  assert.match(migration, /v_user := private\.selfver1_require_member\(p_organization_id, true\);/);
});

test("SELFVER1 migration keeps staff authority and the HP13 allowlist", () => {
  assert.match(migration, /check \(method in \('staff_review','automatic_domain','company_request'\)\)/);
  assert.match(migration, /v_company\.verification_status in \('unverified','pending'\)/);
  assert.match(migration, /'staff_decision'/);
  for (const fn of ["selfver1_try_auto_verify", "selfver1_my_verification_state", "selfver1_request_manual_verification"]) {
    assert.match(migration, new RegExp("create or replace function public\\." + fn + "\\([^)]*\\)\\s*returns jsonb language sql (stable|volatile) security invoker"));
  }
  assert.match(migration, /revoke all on function private\.selfver1_signals\(uuid\) from public, anon, authenticated;/);
  assert.match(gate, /selfver1_company_verification_badge\.sql/);
});
