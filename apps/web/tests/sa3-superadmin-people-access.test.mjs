import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const peoplePage = fs.readFileSync(
  new URL("../app/(platform)/platform/people/page.tsx", import.meta.url),
  "utf8",
);
const peopleActions = fs.readFileSync(
  new URL("../app/(platform)/platform/people/actions.ts", import.meta.url),
  "utf8",
);
const navigation = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/platform-shell.tsx", import.meta.url),
  "utf8",
);
const platformLayout = fs.readFileSync(
  new URL("../app/(platform)/platform/layout.tsx", import.meta.url),
  "utf8",
);
const authFinish = fs.readFileSync(
  new URL("../app/auth/finish/page.tsx", import.meta.url),
  "utf8",
);
const loginActions = fs.readFileSync(
  new URL("../app/login/actions.ts", import.meta.url),
  "utf8",
);
const staffAccess = fs.readFileSync(
  new URL("../app/staff/access/page.tsx", import.meta.url),
  "utf8",
);
const edgeInvite = fs.readFileSync(
  new URL(
    "../../../supabase/functions/sa3-platform-staff-invite/index.ts",
    import.meta.url,
  ),
  "utf8",
);

test("SA3 adds People & Access to the owner control plane", () => {
  assert.match(navigation, /appRoutes\.platform\.people/);
  assert.match(navigation, /People & Access/);
  assert.match(peoplePage, /Invita Platform Staff/);
  assert.match(peoplePage, /Platform Staff/);
  assert.match(peoplePage, /Inviti pendenti/);
  assert.match(peoplePage, /Root authority/);
});

test("SA3 previews fixed role templates and their effective capabilities", () => {
  assert.match(peoplePage, /PLATFORM_STAFF_ROLE_TEMPLATES/);
  assert.match(peoplePage, /PLATFORM_PERMISSIONS/);
  assert.match(peoplePage, /Role template disponibili/);
  assert.match(peoplePage, /permessi effettivi saranno/);
  assert.match(peoplePage, /permission\.risk/);
});

test("SA3 keeps People & Access mutations root-controlled", () => {
  for (const action of [
    "createPlatformStaffInvitation",
    "resendPlatformStaffInvitation",
    "revokePlatformStaffInvitation",
    "updatePlatformStaffRoles",
    "setPlatformStaffStatus",
  ]) {
    assert.match(peopleActions, new RegExp("export async function " + action));
  }
  assert.match(peopleActions, /requirePlatformSuperadmin\(\)/g);
  assert.match(peopleActions, /sa2_create_platform_staff_invitation/);
  assert.match(peopleActions, /sa2_set_platform_staff_roles/);
  assert.match(peopleActions, /sa2_set_platform_staff_status/);
});

test("SA3 invitation email runs in a JWT-protected Edge Function with service credentials isolated from web code", () => {
  assert.match(edgeInvite, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edgeInvite, /auth\.getUser\(token\)/);
  assert.match(edgeInvite, /platform_user_roles/);
  assert.match(edgeInvite, /platform_superadmin/);
  assert.match(edgeInvite, /platform_staff_invitations/);
  assert.match(edgeInvite, /inviteUserByEmail/);
  assert.match(edgeInvite, /invited=1&staff=1/);
  assert.doesNotMatch(peopleActions, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("SA3 staff invite acceptance is separate from organization invitation acceptance", () => {
  assert.match(authFinish, /isStaffInvite/);
  assert.match(authFinish, /sa2_claim_platform_staff_invitation/);
  assert.match(authFinish, /\/staff\/access\?activated=1/);
  assert.match(authFinish, /hp8_claim_organization_invitation/);
  assert.match(authFinish, /invitation_id/);
  assert.doesNotMatch(authFinish, /claim_pending_organization_invitations/);
});

test("SA3 existing users can acquire a pending Platform invitation at normal login", () => {
  assert.match(loginActions, /sa2_claim_platform_staff_invitation/);
  assert.match(loginActions, /platform_access_context/);
  assert.match(loginActions, /authority\.is_platform_staff/);
  assert.match(loginActions, /redirect\("\/staff\/access"\)/);
});

test("SA3 staff status page preserves tenant isolation messaging and lifecycle states", () => {
  assert.match(staffAccess, /Commercial|workspace|tenant/i);
  assert.match(staffAccess, /Sospeso/);
  assert.match(staffAccess, /Revocato/);
  assert.match(staffAccess, /Platform Staff/);
  assert.match(staffAccess, /sa2_claim_platform_staff_invitation/);
});

test("SA3 product language promotes the singleton root to Platform Owner", () => {
  assert.match(platformLayout, /Platform Owner/);
  assert.match(shell, /authorityLabel/);
  assert.doesNotMatch(shell, /Platform Superadmin/);
});
