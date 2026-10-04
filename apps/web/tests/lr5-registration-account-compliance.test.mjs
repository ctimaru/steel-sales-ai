import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261004183000_lr5_registration_account_compliance.sql", import.meta.url),
  "utf8",
);
const form = fs.readFileSync(new URL("../app/register/registration-form.tsx", import.meta.url), "utf8");
const registerActions = fs.readFileSync(new URL("../app/register/actions.ts", import.meta.url), "utf8");
const loginActions = fs.readFileSync(new URL("../app/login/actions.ts", import.meta.url), "utf8");
const legalPage = fs.readFileSync(new URL("../app/legal/accept/page.tsx", import.meta.url), "utf8");
const workspaceContext = fs.readFileSync(new URL("../lib/workspace-context.ts", import.meta.url), "utf8");
const accountPage = fs.readFileSync(new URL("../app/(workspace)/account/page.tsx", import.meta.url), "utf8");
const exportRoute = fs.readFileSync(new URL("../app/api/account/export/route.ts", import.meta.url), "utf8");
const contract = fs.readFileSync(new URL("../lib/account-legal.ts", import.meta.url), "utf8");

test("LR5 records Privacy acknowledgement and Terms acceptance separately and immutably", () => {
  assert.match(migration, /user_legal_acceptances/);
  assert.match(migration, /privacy_notice_version/);
  assert.match(migration, /privacy_acknowledged_at/);
  assert.match(migration, /terms_version/);
  assert.match(migration, /terms_accepted_at/);
  assert.match(migration, /LR5 compliance evidence is immutable/);
  assert.match(contract, /privacyAcknowledgementIsConsent: false/);
});

test("LR5 requires both legal confirmations in registration and first-login UX", () => {
  assert.match(form, /name="privacy_acknowledged"/);
  assert.match(form, /name="terms_accepted"/);
  assert.match(registerActions, /lr5_record_legal_acceptance/);
  assert.match(registerActions, /p_source: "registration"/);
  assert.match(legalPage, /Due conferme, tenute separate/);
  assert.match(legalPage, /non equivale a/);
  assert.match(legalPage, /prestare consenso/);
});

test("LR5 gates authenticated workspace access on current legal evidence", () => {
  assert.match(loginActions, /lr5_current_legal_acceptance_state/);
  assert.match(loginActions, /\/legal\/accept\?next=/);
  assert.match(workspaceContext, /lr5_current_legal_acceptance_state/);
  assert.match(workspaceContext, /lr5_account_lifecycle_state/);
  assert.match(workspaceContext, /account-closure\?requested=1/);
});

test("LR5 exposes a scoped self-service account export", () => {
  assert.match(migration, /lr5_account_export/);
  assert.match(migration, /Organization-controlled Commercial Memory/);
  assert.match(exportRoute, /Content-Disposition/);
  assert.match(exportRoute, /no-store/);
  assert.match(accountPage, /Scarica export JSON/);
});

test("LR5 account closure suspends access but does not pretend hard deletion is always immediate", () => {
  assert.match(migration, /lr5_request_account_erasure/);
  assert.match(migration, /hard_delete_automatic',false/);
  assert.match(migration, /set status='suspended'/);
  assert.match(migration, /platform_superadmin_protected/);
  assert.match(migration, /last_organization_admin/);
  assert.match(accountPage, /Chiudi account e richiedi cancellazione/);
});

test("LR5 enforces registration retention with a daily database cron", () => {
  assert.match(migration, /interval '90 days'/);
  assert.match(migration, /interval '12 months'/);
  assert.match(migration, /interval '24 months'/);
  assert.match(migration, /Retention redacted/);
  assert.match(migration, /lr5-retention-cleanup-daily/);
  assert.match(migration, /15 3 \* \* \*/);
});

test("LR5 keeps the legal versions aligned across SQL and application contract", () => {
  assert.match(migration, /2026-10-04-lr5-v1/);
  assert.match(contract, /ACCOUNT_PRIVACY_NOTICE_VERSION = "2026-10-04-lr5-v1"/);
  assert.match(contract, /ACCOUNT_TERMS_VERSION = "2026-10-04-lr5-v1"/);
});
