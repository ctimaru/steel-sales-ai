import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260930110000_hp3_registration_state_machine_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const stateContract = fs.readFileSync(
  new URL("../lib/registration-state.ts", import.meta.url),
  "utf8",
);
const queuePage = fs.readFileSync(
  new URL("../app/(platform)/platform/registrations/page.tsx", import.meta.url),
  "utf8",
);
const detailPage = fs.readFileSync(
  new URL("../app/(platform)/platform/registrations/[id]/page.tsx", import.meta.url),
  "utf8",
);
const statusPage = fs.readFileSync(
  new URL("../app/registration/status/page.tsx", import.meta.url),
  "utf8",
);
const platformAdmin = fs.readFileSync(
  new URL("../lib/platform-admin.ts", import.meta.url),
  "utf8",
);

test("HP3 freezes the canonical six-state registration contract", () => {
  for (const status of [
    "draft",
    "pending_review",
    "needs_information",
    "approved",
    "rejected",
    "activated",
  ]) {
    assert.match(stateContract, new RegExp(`"${status}"`));
  }

  for (const legacy of [
    "submitted",
    "email_verification_pending",
    "withdrawn",
    "suspended",
  ]) {
    assert.doesNotMatch(stateContract, new RegExp(`"${legacy}"`));
  }
});

test("HP3 centralizes the legal transition matrix in the database", () => {
  assert.match(migration, /hp3_registration_transition_allowed/);
  assert.match(migration, /draft' and p_to_status = 'pending_review'/);
  assert.match(
    migration,
    /pending_review' and p_to_status in \([\s\S]*?'needs_information'[\s\S]*?'approved'[\s\S]*?'rejected'/,
  );
  assert.match(
    migration,
    /needs_information' and p_to_status = 'pending_review'/,
  );
  assert.match(migration, /approved' and p_to_status = 'activated'/);
  assert.match(migration, /invalid registration transition/);
  assert.match(migration, /before update of application_status/);
});

test("HP3 makes submit and review decisions retry-safe", () => {
  assert.match(
    migration,
    /application_status = 'pending_review'[\s\S]*?'idempotent_replay', true/,
  );
  assert.match(
    migration,
    /application_status = 'needs_information'[\s\S]*?'idempotent_replay', true/,
  );
  assert.match(
    migration,
    /application_status = 'approved'[\s\S]*?'idempotent_replay', true/,
  );
  assert.match(
    migration,
    /application_status = 'rejected'[\s\S]*?rejected application decision is immutable/,
  );
  assert.match(
    migration,
    /v_from_status[\s\S]*?'resubmission', v_from_status = 'needs_information'/,
  );
});

test("HP3 prevents duplicate one-time registration audit events", () => {
  assert.match(
    migration,
    /platform_registration_events_singleton_event_uidx/,
  );
  for (const eventType of [
    "application_created",
    "email_verified",
    "application_approved",
    "application_rejected",
    "activation_completed",
  ]) {
    assert.match(migration, new RegExp(`'${eventType}'`));
  }
  assert.match(migration, /invalid registration event transition/);
});

test("HP3 removes legacy statuses from applicant and Platform registration UI", () => {
  for (const source of [queuePage, detailPage, statusPage]) {
    assert.doesNotMatch(source, /submitted:/);
    assert.doesNotMatch(source, /email_verification_pending:/);
    assert.doesNotMatch(source, /suspended:/);
  }

  assert.match(queuePage, /isRegistrationApplicationStatus\(status\)/);
  assert.match(statusPage, /isRegistrationApplicationStatus\(application\.application_status\)/);
});

test("HP3 types registration read models with the shared state contract", () => {
  assert.match(
    platformAdmin,
    /application_status: RegistrationApplicationStatus;/,
  );
  assert.match(
    platformAdmin,
    /status\?: RegistrationApplicationStatus \| null/,
  );
});
