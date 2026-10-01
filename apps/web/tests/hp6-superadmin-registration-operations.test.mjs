import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261001122621_hp6_superadmin_registration_operations.sql",
    import.meta.url,
  ),
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
const actions = fs.readFileSync(
  new URL("../app/(workspace)/admin/registrations/actions.ts", import.meta.url),
  "utf8",
);
const platformAdmin = fs.readFileSync(
  new URL("../lib/platform-admin.ts", import.meta.url),
  "utf8",
);

test("HP6 central queue carries aging, next action and identity risk", () => {
  assert.match(migration, /hp6_registration_operations_queue_impl/);
  assert.match(migration, /perform private\.require_platform_permission\('registrations\.read'\)/);
  assert.match(migration, /operational_lane/);
  assert.match(migration, /next_action/);
  assert.match(migration, /age_hours/);
  assert.match(migration, /identity_conflicts/);
  assert.match(migration, /pending_over_24h/);
  assert.match(platformAdmin, /hp6_registration_operations_queue/);
  assert.match(platformAdmin, /RegistrationOperationsSummary/);
});

test("HP6 queue supports bounded search without creating another registration model", () => {
  assert.match(migration, /p_query text default null/);
  assert.match(migration, /p_limit integer default 200/);
  assert.match(migration, /least\(greatest\(coalesce\(p_limit,200\),1\),250\)/);
  assert.match(migration, /lower\(o\.legal_name\) like/);
  assert.match(queuePage, /Cerca azienda, email, P\.IVA o registro impresa/);
  assert.match(queuePage, /Conflitti identità/);
  assert.match(queuePage, /Prossima azione/);
});

test("HP6 identity summary stays private and public queue is invoker-only", () => {
  assert.match(migration, /private\.hp6_registration_identity_summary/);
  assert.match(
    migration,
    /revoke all on function private\.hp6_registration_identity_summary\(uuid\)[\s\S]*?from public,anon,authenticated/,
  );
  assert.match(
    migration,
    /public\.hp6_registration_operations_queue[\s\S]*?security invoker/,
  );
  assert.match(
    migration,
    /revoke all on function public\.hp6_registration_operations_queue\(text,text,integer\)[\s\S]*?from public,anon/,
  );
});

test("HP6 approve-and-activate is atomic and permission gated", () => {
  assert.match(migration, /hp6_approve_and_activate_registration_impl/);
  assert.match(migration, /registrations\.approve/);
  assert.match(migration, /registrations\.activate/);
  assert.match(migration, /registrations\.bridge_network/);
  assert.match(migration, /private\.p0a_approve_registration_application_impl/);
  assert.match(migration, /private\.hp1_1_activate_registration_application_impl/);
  assert.match(actions, /approveAndActivateRegistration/);
  assert.match(actions, /hp6_approve_and_activate_registration/);
});

test("HP6 detail keeps slow path while adding one-transaction fast path", () => {
  assert.match(detailPage, /HP6 · Fast path/);
  assert.match(detailPage, /Approva e attiva/);
  assert.match(detailPage, /approveAndActivateRegistration/);
  assert.match(detailPage, /approveRegistrationApplication/);
  assert.match(detailPage, /requestRegistrationInformation/);
  assert.match(detailPage, /rejectRegistrationApplication/);
});

test("HP6 audit shows the concrete actor when available", () => {
  assert.match(migration, /'actor_email',u\.email/);
  assert.match(platformAdmin, /actor_email: string \| null/);
  assert.match(detailPage, /event\.actor_email \?\? event\.actor_type/);
});
