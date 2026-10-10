import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

const layout = fs.readFileSync(
  new URL("../app/(platform)/platform/layout.tsx", import.meta.url),
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
const home = fs.readFileSync(
  new URL("../app/(platform)/platform/page.tsx", import.meta.url),
  "utf8",
);
const registrations = fs.readFileSync(
  new URL("../app/(platform)/platform/registrations/page.tsx", import.meta.url),
  "utf8",
);
const registrationDetail = fs.readFileSync(
  new URL("../app/(platform)/platform/registrations/[id]/page.tsx", import.meta.url),
  "utf8",
);
const registrationActions = fs.readFileSync(
  new URL("../app/(workspace)/admin/registrations/actions.ts", import.meta.url),
  "utf8",
);
const discovery = fs.readFileSync(
  new URL("../app/(platform)/platform/company-discovery/page.tsx", import.meta.url),
  "utf8",
);
const people = fs.readFileSync(
  new URL("../app/(platform)/platform/people/page.tsx", import.meta.url),
  "utf8",
);
const loginActions = fs.readFileSync(
  new URL("../app/login/actions.ts", import.meta.url),
  "utf8",
);
const authFinish = fs.readFileSync(
  new URL("../app/auth/finish/page.tsx", import.meta.url),
  "utf8",
);
const staffAccess = fs.readFileSync(
  new URL("../app/staff/access/page.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260928171500_sa4_registration_delegation_cutover.sql",
    import.meta.url,
  ),
  "utf8",
);

test("SA4 opens the Platform shell through capability context rather than root-only context", () => {
  assert.match(layout, /requirePlatformConsoleContext/);
  assert.doesNotMatch(layout, /requirePlatformContext/);
  assert.match(layout, /context\.permissions/);
  assert.match(layout, /context\.is_platform_owner/);
});

test("SA4 keeps the registration delegation invariant while later domains may cut over independently", () => {
  assert.match(platformIa, /key: "registrations"[\s\S]*?access: \{ kind: "permission", key: "registrations\\.read" \}/);
  assert.match(platformIa, /key: "people"[\s\S]*?access: \{ kind: "owner_only" \}/);
  assert.match(navigation, /getPlatformIaVisibleModules/);
});

test("SA4 makes Platform Home and shell authority-aware without implying tenant access", () => {
  assert.match(home, /canReadRegistrations/);
  assert.match(home, /context\.permissions\.includes\("registrations\.read"\)/);
  assert.match(home, /context\.is_platform_owner/);
  assert.match(home, /Nessun modulo operativo ancora abilitato/);
  assert.match(shell, /isPlatformOwner \?/);
  assert.match(shell, /dati commerciali delle aziende restano separati/);
});

test("SA4 cuts registration read routes over to registrations.read", () => {
  assert.match(registrations, /requirePlatformPermission\("registrations\.read"\)/);
  assert.doesNotMatch(registrations, /requirePlatformSuperadmin/);
  assert.match(registrationDetail, /requirePlatformPermission\("registrations\.read"\)/);
  assert.doesNotMatch(registrationDetail, /requirePlatformSuperadmin/);
});

test("SA4 renders each registration mutation only when its dedicated capability is present", () => {
  for (const permission of [
    "registrations.request_information",
    "registrations.approve",
    "registrations.reject",
    "registrations.activate",
    "registrations.bridge_network",
  ]) {
    assert.match(
      registrationDetail,
      new RegExp("permissions\\.includes\\(\"" + permission.replaceAll(".", "\\.") + "\"\\)"),
    );
  }
  assert.match(registrationDetail, /canRequestInformation/);
  assert.match(registrationDetail, /canApprove/);
  assert.match(registrationDetail, /canReject/);
  assert.match(registrationDetail, /canActivate/);
  assert.match(registrationDetail, /canBridge/);
});

test("SA4 server actions recheck dedicated registration permissions before RPC execution", () => {
  const pairs = [
    ["requestRegistrationInformation", "registrations.request_information"],
    ["approveRegistrationApplication", "registrations.approve"],
    ["rejectRegistrationApplication", "registrations.reject"],
    ["activateRegistrationApplication", "registrations.activate"],
    ["bridgeRegistrationToNetwork", "registrations.bridge_network"],
  ];
  for (const [action, permission] of pairs) {
    assert.match(
      registrationActions,
      new RegExp(
        "export async function " +
          action +
          "[\\s\\S]*?requirePlatformPermission\\(\"" +
          permission.replaceAll(".", "\\.") +
          "\"\\)",
      ),
    );
  }
});

test("SA4 database cutover maps all registration RPCs to explicit capabilities", () => {
  for (const permission of [
    "registrations.read",
    "registrations.request_information",
    "registrations.approve",
    "registrations.reject",
    "registrations.activate",
    "registrations.bridge_network",
  ]) {
    assert.match(migration, new RegExp("require_platform_permission\\('" + permission.replaceAll(".", "\\.") + "'\\)"));
  }
  assert.match(migration, /platform_owner/);
  assert.match(migration, /platform_staff/);
  assert.match(migration, /sa4_record_registration_action/);
  assert.match(migration, /registration_network_bridge_completed/);
});

test("SA4 keeps People & Access root-only while later operational domains may cut over separately", () => {
  assert.match(discovery, /Company Discovery/);
  assert.match(people, /context\.is_platform_owner/);
  assert.match(people, /redirect\("\/platform"\)/);
});

test("SA4 routes active delegated staff into the console while suspended or revoked staff remain on status page", () => {
  assert.match(loginActions, /authority\.staff_status === "active"/);
  assert.match(loginActions, /authority\.permissions\?\.includes\("platform\.console\.access"\)/);
  assert.match(loginActions, /redirect\("\/platform"\)/);
  assert.match(loginActions, /redirect\("\/staff\/access"\)/);

  assert.match(authFinish, /platform_access_context/);
  assert.match(authFinish, /router\.replace\("\/platform"\)/);
  assert.match(authFinish, /router\.replace\("\/staff\/access\?activated=1"\)/);

  assert.match(staffAccess, /canOpenPlatform/);
  assert.match(staffAccess, /href="\/platform"/);
  assert.match(staffAccess, /non concede accesso automatico ai dati commerciali/);
});
