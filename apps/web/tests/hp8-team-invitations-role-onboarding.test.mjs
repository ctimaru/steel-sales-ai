import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authFinish = fs.readFileSync(
  new URL("../app/auth/finish/page.tsx", import.meta.url),
  "utf8",
);
const onboarding = fs.readFileSync(
  new URL("../app/onboarding/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/onboarding/actions.ts", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(
  new URL("../lib/routes.ts", import.meta.url),
  "utf8",
);
const navigation = fs.readFileSync(
  new URL("../components/workspace-navigation.tsx", import.meta.url),
  "utf8",
);
const worker = fs.readFileSync(
  new URL("../../../services/worker/app/tenant_admin.py", import.meta.url),
  "utf8",
);
const config = fs.readFileSync(
  new URL("../../../supabase/config.toml", import.meta.url),
  "utf8",
);
const inviteTemplate = fs.readFileSync(
  new URL("../../../supabase/templates/invite.html", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261001132810_hp8_team_invitations_role_onboarding.sql",
    import.meta.url,
  ),
  "utf8",
);
const deterministicMigration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261001132908_hp8a_deterministic_legacy_invitation_claim.sql",
    import.meta.url,
  ),
  "utf8",
);

test("HP8 binds organization acceptance to one invitation id", () => {
  assert.match(authFinish, /invitation_id/);
  assert.match(authFinish, /hp8_invitation_context/);
  assert.match(authFinish, /hp8_claim_organization_invitation/);
  assert.doesNotMatch(authFinish, /claim_pending_organization_invitations/);
  assert.doesNotMatch(onboarding, /claim_pending_organization_invitations/);
  assert.match(worker, /query\["invitation_id"\] = invitation_id/);
  assert.match(
    deterministicMigration,
    /multiple pending invitations require explicit invitation id/,
  );
});

test("HP8 carries permission and business role through invitation onboarding", () => {
  assert.match(worker, /business_role: BusinessRole \| None/);
  assert.match(worker, /"business_role": business_role/);
  assert.match(onboarding, /name="business_role"/);
  assert.match(onboarding, /Sales Director/);
  assert.match(onboarding, /Commerciale/);
  assert.match(onboarding, /Operations/);
  assert.match(authFinish, /organizationInvitation\.business_role/);
  assert.match(migration, /business_role text/);
  assert.match(
    migration,
    /organization_id,user_id,role,business_role,status,is_default/,
  );
});

test("HP8 invitation lifecycle supports resend expiry revoke and delivery evidence", () => {
  assert.match(actions, /export async function resendInvitation/);
  assert.match(actions, /export async function revokeInvitation/);
  assert.match(actions, /hp8_revoke_organization_invitation/);
  assert.match(onboarding, /Reinvia/);
  assert.match(onboarding, /Revoca/);
  assert.match(onboarding, /Invio da riprovare/);
  assert.match(onboarding, /send_count/);
  assert.match(worker, /delivery_status/);
  assert.match(worker, /delivery_mode/);
  assert.match(worker, /last_delivery_error/);
  assert.match(migration, /expired_at/);
});

test("HP8 handles both new and existing Supabase Auth identities", () => {
  assert.match(worker, /hp8_auth_user_lookup/);
  assert.match(worker, /existing_identity/);
  assert.match(worker, /sign_in_with_otp/);
  assert.match(worker, /should_create_user/);
  assert.match(worker, /invite_user_by_email/);
  assert.match(worker, /set_password/);
  assert.match(authFinish, /set_password/);
  assert.match(authFinish, /router\.replace\("\/dashboard\?joined=1"\)/);
});

test("HP8 worker administration endpoint fails closed", () => {
  assert.match(
    worker,
    /if not expected:\s*raise HTTPException\(status_code=503/,
  );
  assert.match(worker, /if x_worker_token != expected:/);
  assert.match(worker, /status_code=401/);
  assert.match(worker, /User already has active organization membership/);
});

test("HP8 member access lifecycle remains admin governed", () => {
  assert.match(actions, /export async function changeMemberStatus/);
  assert.match(actions, /requireWorkspaceAdmin/);
  assert.match(actions, /hp8_set_organization_member_status/);
  assert.match(onboarding, /Sospendi accesso/);
  assert.match(onboarding, /Riattiva accesso/);
  assert.match(migration, /cannot suspend your own organization membership/);
  assert.match(migration, /cannot suspend the last active organization admin/);
});

test("HP8 keeps team administration reachable from Company navigation", () => {
  assert.match(routes, /team: "\/onboarding#team-access"/);
  assert.match(navigation, /Team e accessi/);
  assert.match(onboarding, /id="team-access"/);
  assert.match(onboarding, /HP8 · Team onboarding/);
});

test("HP8 versions the branded invite email template", () => {
  assert.match(config, /\[auth\.email\.template\.invite\]/);
  assert.match(config, /supabase\/templates\/invite\.html/);
  assert.match(inviteTemplate, /Smart Steel Sales/);
  assert.match(inviteTemplate, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(inviteTemplate, /Accetta l’invito/);
});

test("HP8 service-role Auth lookup is not browser executable", () => {
  assert.match(migration, /hp8_auth_user_lookup/);
  assert.match(
    migration,
    /revoke all on function public\.hp8_auth_user_lookup\(text\)[\s\S]*?authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.hp8_auth_user_lookup\(text\)[\s\S]*?service_role/,
  );
});
