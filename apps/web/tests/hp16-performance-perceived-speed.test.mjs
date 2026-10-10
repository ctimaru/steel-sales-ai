import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const workspaceContext = read("../lib/workspace-context.ts");
const platformAdmin = read("../lib/platform-admin.ts");
const workspaceLayout = read("../app/(workspace)/layout.tsx");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");
const platformHome = read("../app/(platform)/platform/page.tsx");
const loginActions = read("../app/login/actions.ts");
const commercialData = read("../lib/commercial-data.ts");
const routeLoading = read("../components/route-loading.tsx");
const workspaceLoading = read("../app/(workspace)/loading.tsx");
const platformLoading = read("../app/(platform)/platform/loading.tsx");

test("HP16 deduplicates shared auth/context work inside one server request", () => {
  assert.match(workspaceContext, /import \{ cache \} from "react"/);
  assert.match(workspaceContext, /getWorkspaceContext = cache\(/);
  assert.match(platformAdmin, /getPlatformAccessContext = cache\(/);
  assert.match(platformAdmin, /requirePlatformConsoleContext = cache\(/);
  assert.match(
    platformAdmin,
    /hasPlatformPermission[\s\S]*getPlatformAccessContext\(\)/,
  );
  assert.doesNotMatch(platformAdmin, /rpc\("has_platform_permission"/);
  assert.match(
    platformAdmin,
    /requirePlatformConsoleContext[\s\S]*getPlatformAccessContext\(\)/,
  );
});

test("HP16 starts independent workspace shell dependencies together", () => {
  assert.match(
    workspaceLayout,
    /Promise\.all\(\[\s*getWorkspaceContext\(\),\s*createClient\(\),\s*\]\)/,
  );
});

test("HP16 keeps Dashboard critical reads in one parallel batch", () => {
  assert.match(
    dashboard,
    /\[setup, commercial, received, activity\] = await Promise\.all/,
  );
  assert.doesNotMatch(
    dashboard,
    /const setup = isAdmin\s*\? await getCompanySetupState/,
  );
});

test("HP16 removes the Platform Home queue waterfall", () => {
  assert.match(platformHome, /await getPlatformCockpitSnapshot\(context\)/);
  const cockpit = fs.readFileSync(new URL("../lib/platform-cockpit.ts", import.meta.url), "utf8");
  assert.match(cockpit, /await Promise\.all/);
  assert.match(cockpit, /p_limit: 1/);
  assert.doesNotMatch(
    platformHome,
    /canReadRegistrations \? await getRegistrationQueue/,
  );
});

test("HP16 parallelizes independent post-login invitation claims", () => {
  assert.match(
    loginActions,
    /Promise\.all\(\[[\s\S]*claim_pending_organization_invitations[\s\S]*sa2_claim_platform_staff_invitation/,
  );
});

test("HP16 removes the commercial dashboard metrics round-trip waterfall", () => {
  assert.match(
    commercialData,
    /\{ data: metricRows, error: metricError \}[\s\S]*= await Promise\.all/,
  );
  assert.match(
    commercialData,
    /supabase\.rpc\("commercial_dashboard_metrics"\)/,
  );
});

test("HP16 provides zero-JS loading shells for the two authenticated route trees", () => {
  assert.doesNotMatch(routeLoading, /"use client"/);
  assert.match(routeLoading, /aria-busy="true"/);
  assert.match(routeLoading, /animate-pulse/);
  assert.match(workspaceLoading, /RouteLoading/);
  assert.match(platformLoading, /variant="platform"/);
});
