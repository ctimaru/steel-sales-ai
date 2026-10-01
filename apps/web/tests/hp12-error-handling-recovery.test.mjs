import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const errorModel = read("../lib/user-facing-error.ts");
const pendingButton = read("../components/pending-submit-button.tsx");
const workspaceError = read("../app/(workspace)/error.tsx");
const platformError = read("../app/(platform)/error.tsx");
const rootError = read("../app/error.tsx");
const globalError = read("../app/global-error.tsx");
const workspaceContext = read("../lib/workspace-context.ts");
const loginActions = read("../app/login/actions.ts");
const verifyActions = read("../app/verify-email/actions.ts");
const registerActions = read("../app/register/actions.ts");
const registrationStatus = read("../app/registration/status/page.tsx");
const loginPage = read("../app/login/page.tsx");
const registerPage = read("../app/register/page.tsx");
const verifyPage = read("../app/verify-email/page.tsx");
const forgotPasswordPage = read("../app/forgot-password/page.tsx");
const onboardingPage = read("../app/onboarding/page.tsx");
const networkActions = read("../app/(workspace)/network/actions.ts");
const productActions = read("../app/(workspace)/products/actions.ts");
const migration = read(
  "../../../supabase/migrations/20261001165500_hp12_error_handling_recovery.sql",
);

test("HP12 centralizes safe error classification and never falls back to raw technical text", () => {
  for (const code of [
    "session_expired",
    "email_not_confirmed",
    "permission_denied",
    "rate_limited",
    "not_found",
    "conflict",
    "validation",
    "temporary_unavailable",
    "operation_failed",
  ]) {
    assert.match(errorModel, new RegExp(`"${code}"`));
  }

  assert.match(errorModel, /safeErrorMessage/);
  assert.match(errorModel, /feedbackPath/);
  assert.match(errorModel, /sessionRecoveryPath/);
  assert.doesNotMatch(
    errorModel,
    /return\s+\{[^}]*message:\s*error\.message/s,
  );
});

test("HP12 provides retryable route boundaries without exposing error.message", () => {
  for (const source of [
    workspaceError,
    platformError,
    rootError,
    globalError,
  ]) {
    assert.match(source, /reset/);
    assert.match(source, /Riprova/);
    assert.doesNotMatch(source, /error\.message/);
  }

  assert.match(workspaceError, /Riferimento tecnico/);
  assert.match(globalError, /digest/);
});

test("HP12 workspace context recovers expired sessions and hides database internals", () => {
  assert.match(workspaceContext, /sessionRecoveryPath/);
  assert.match(workspaceContext, /toUserFacingIssue/);
  assert.match(workspaceContext, /workspace_auth_unavailable/);
  assert.match(workspaceContext, /workspace_membership_unavailable/);
  assert.match(workspaceContext, /workspace_organization_unavailable/);
  assert.doesNotMatch(workspaceContext, /throw new Error\(membershipError\.message\)/);
  assert.doesNotMatch(workspaceContext, /throw new Error\(organizationError\.message\)/);
});

test("HP12 Auth handling uses structured Supabase error codes", () => {
  for (const code of [
    "user_already_exists",
    "user_repeated_signup",
    "weak_password",
    "over_email_send_rate_limit",
    "over_request_rate_limit",
  ]) {
    assert.match(loginActions + verifyActions, new RegExp(code));
  }
  assert.match(loginActions, /safeErrorMessage/);
  assert.match(verifyActions, /safeErrorMessage/);
  assert.doesNotMatch(loginActions, /error\.message\.toLowerCase/);
  assert.doesNotMatch(verifyActions, /error\.message\.toLowerCase/);
});

test("HP12 registration recovery read model is applicant scoped and exposes only recovery-safe review detail", () => {
  assert.match(migration, /hp12_registration_recovery_state_impl/);
  assert.match(migration, /v_user_id := \(select auth\.uid\(\)\)/);
  assert.match(migration, /a\.applicant_user_id=v_user_id/);
  assert.match(migration, /information_requested/);
  assert.match(migration, /rejection_reason_code/);
  assert.match(migration, /rejection_note/);
  assert.match(migration, /HP12-registration-recovery-v1/);
  assert.match(migration, /security definer/);
  assert.match(migration, /security invoker/);
  assert.match(
    migration,
    /revoke all on function public\.hp12_registration_recovery_state\(uuid\)[\s\S]*from public,anon/,
  );
});

test("HP12 reapplication preserves terminal rejection and is race-safe", () => {
  assert.match(migration, /hp12_reapply_registration_impl/);
  assert.match(migration, /v_source\.application_status<>'rejected'/);
  assert.match(migration, /'incomplete_information'/);
  assert.match(migration, /'unverifiable_identity'/);
  assert.match(migration, /insert into public\.company_registration_applications/);
  assert.match(migration, /exception[\s\S]*when unique_violation/);
  assert.match(migration, /'idempotent_replay',true/);
  assert.doesNotMatch(
    migration,
    /update public\.company_registration_applications[\s\S]*where id=p_application_id/,
  );
});

test("HP12 registration UI shows requested information, rejection reason, and controlled recovery", () => {
  assert.match(registrationStatus, /hp12_registration_recovery_state/);
  assert.match(registrationStatus, /Cosa aggiornare/);
  assert.match(registrationStatus, /Motivo/);
  assert.match(registrationStatus, /Dettaglio della revisione/);
  assert.match(registrationStatus, /Correggi e ripresenta/);
  assert.match(registrationStatus, /restartRejectedRegistration/);
  assert.match(registerActions, /hp12_reapply_registration/);
  assert.match(registerActions, /feedbackPath/);
});

test("HP12 reusable pending control prevents duplicate server-action submissions", () => {
  assert.match(pendingButton, /useFormStatus/);
  assert.match(pendingButton, /disabled=\{blocked\}/);
  assert.match(pendingButton, /aria-busy=\{pending\}/);

  for (const source of [
    loginPage,
    registerPage,
    verifyPage,
    forgotPasswordPage,
    onboardingPage,
    registrationStatus,
  ]) {
    assert.match(source, /PendingSubmitButton/);
  }

  assert.match(onboardingPage, /pendingLabel="Salvataggio…"/);
  assert.match(onboardingPage, /pendingLabel="Invio…"/);
});

test("HP12 critical Network and Product surfaces do not expose raw backend errors", () => {
  assert.match(networkActions, /safeErrorMessage/);
  assert.doesNotMatch(
    networkActions,
    /encodeURIComponent\((?:error|uploadError|profileError)\.message\)/,
  );
  assert.doesNotMatch(
    networkActions,
    /managedProfilePath\("error",\s*(?:error|uploadError|profileError)\.message/,
  );

  assert.match(productActions, /safeErrorMessage/);
  assert.doesNotMatch(
    productActions,
    /error instanceof Error \? error\.message/,
  );
  assert.doesNotMatch(
    productActions,
    /throw new Error\(payload\?\.detail/,
  );
});

test("HP12 keeps recovery separate from authorization and Marketplace authority", () => {
  assert.doesNotMatch(
    migration,
    /marketplace_entitlement_events|marketplace_unlocks|marketplace_responses/,
  );
  assert.doesNotMatch(
    migration,
    /insert into public\.(rfqs|offers|orders)/i,
  );
  assert.doesNotMatch(errorModel, /service_role|SUPABASE_SECRET|WORKER_INTERNAL_TOKEN/);
});
