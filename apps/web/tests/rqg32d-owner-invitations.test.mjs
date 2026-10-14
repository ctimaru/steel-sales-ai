import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const page = readFileSync(new URL("app/(italian)/(platform)/platform/people/page.tsx", root), "utf8");
const action = readFileSync(new URL("app/(italian)/(platform)/platform/people/actions.ts", root), "utf8");
const identities = readFileSync(new URL("lib/rqg32d-test-persona-invitations.ts", root), "utf8");
const login = readFileSync(new URL("app/(italian)/login/actions.ts", root), "utf8");

test("RQG3.2d four distinct synthetic QA identities have exactly one preselected delegated role each", () => {
  const pairs = [
    ["registration","registration_admin"],
    ["claims","claims_verification_admin"],
    ["trust","network_trust_admin"],
    ["auditor","platform_auditor"],
  ];
  for (const [tag,role] of pairs) {
    assert.match(identities, new RegExp("rqg32-"+tag+"@smartsteelsales\\.test"));
    assert.match(identities,new RegExp('role: "'+role+'"'));
  }
  assert.equal((identities.match(/email: "rqg32-/g) ?? []).length,4);
  assert.doesNotMatch(identities,/platform_superadmin|rqg32-company-a|rqg32-viewer/);
});

test("RQG3.2d invitation UI remains sole-Owner gated and delegates only to audited invitation RPC", () => {
  assert.match(page,/requirePlatformConsoleContext\\(\\)/);
  assert.match(page,/!context\\.is_platform_owner/);
  assert.match(page,/qaStaff\\.map/);
  assert.match(page,/action=\\{createPlatformStaffInvitation\\}/);
  assert.match(page,/name="roles" value=\\{persona\\.role\\}/);
  assert.match(page,/name="email" value=\\{persona\\.email\\}/);
  assert.match(page,/disabled=\\{persona\\.active \\|\\| persona\\.pending\\}/);
  assert.match(action,/await requirePlatformSuperadmin\\(\\)/);
  assert.match(action,/sa2_create_platform_staff_invitation/);
  assert.doesNotMatch(action,/insert into platform_staff|insert into platform_staff_roles|auth\\.admin\\.createUser/);
});

test("RQG3.2d bypasses deliverability only for exact synthetic email and matching role", () => {
  assert.match(action,/roles\\.length === 1/);
  assert.match(action,/persona\\.email === email && persona\\.role === roles\\[0\\]/);
  assert.ok(action.indexOf("if (isGovernedQAInvitation)") < action.indexOf("const delivery = await sendPlatformStaffInviteEmail(email);"));
  assert.match(login,/sa2_claim_platform_staff_invitation/);
});
