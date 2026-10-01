import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261001125350_hp7_first_login_guided_company_setup.sql",
    import.meta.url,
  ),
  "utf8",
);
const setupLib = fs.readFileSync(
  new URL("../lib/company-setup.ts", import.meta.url),
  "utf8",
);
const workspaceContext = fs.readFileSync(
  new URL("../lib/workspace-context.ts", import.meta.url),
  "utf8",
);
const loginActions = fs.readFileSync(
  new URL("../app/login/actions.ts", import.meta.url),
  "utf8",
);
const onboardingPage = fs.readFileSync(
  new URL("../app/onboarding/page.tsx", import.meta.url),
  "utf8",
);
const onboardingActions = fs.readFileSync(
  new URL("../app/onboarding/actions.ts", import.meta.url),
  "utf8",
);
const dashboard = fs.readFileSync(
  new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url),
  "utf8",
);
const uploadActions = fs.readFileSync(
  new URL("../app/(workspace)/uploads/actions.ts", import.meta.url),
  "utf8",
);
const bulkActions = fs.readFileSync(
  new URL("../app/(workspace)/uploads/bulk-actions.ts", import.meta.url),
  "utf8",
);
const uploadPage = fs.readFileSync(
  new URL("../app/(workspace)/uploads/page.tsx", import.meta.url),
  "utf8",
);
const uploadLayout = fs.readFileSync(
  new URL("../app/(workspace)/operations/uploads/layout.tsx", import.meta.url),
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

test("HP7 makes guided setup measurable from activation to first value", () => {
  for (const column of [
    "first_workspace_seen_at",
    "guided_setup_completed_at",
    "first_value_at",
  ]) {
    assert.match(migration, new RegExp(column));
  }

  assert.match(migration, /hp7_company_setup_state_impl/);
  assert.match(migration, /essential_completion_percentage/);
  assert.match(migration, /time_to_setup_seconds/);
  assert.match(migration, /time_to_first_value_seconds/);
  assert.match(migration, /public\.documents/);
  assert.match(migration, /public\.messages/);
  assert.match(migration, /public\.rfqs/);
  assert.match(migration, /public\.offers/);
  assert.match(migration, /public\.orders/);
  assert.match(setupLib, /getCompanySetupState/);
});

test("HP7 setup state is tenant-scoped and public RPC remains invoker-only", () => {
  assert.match(
    migration,
    /organization_memberships[\s\S]*?m\.organization_id = p_organization_id[\s\S]*?m\.user_id = v_user_id[\s\S]*?m\.status = 'active'/,
  );
  assert.match(
    migration,
    /create or replace function public\.hp7_company_setup_state[\s\S]*?security invoker/,
  );
  assert.match(
    migration,
    /revoke all on function public\.hp7_company_setup_state\(uuid\)[\s\S]*?from public, anon/,
  );
});

test("HP7 removes the rigid workspace completion gate", () => {
  assert.doesNotMatch(
    workspaceContext,
    /organization\.onboarding_status !== "completed"\) redirect\("\/onboarding"\)/,
  );
  assert.match(workspaceContext, /guidedSetupComplete/);
  assert.match(workspaceContext, /commercialMemoryReady/);
  assert.match(workspaceContext, /requireCommercialMemoryReady/);
  assert.match(
    loginActions,
    /guided_setup_completed_at[\s\S]*?\/dashboard[\s\S]*?\/onboarding/,
  );
});

test("HP7 keeps Commercial Memory writes fail-closed until sources and consent are ready", () => {
  for (const source of [uploadActions, bulkActions, uploadPage, uploadLayout]) {
    assert.match(source, /requireCommercialMemoryReady/);
  }
  assert.match(
    workspaceContext,
    /source_preferences[\s\S]*?consent_version[\s\S]*?consent_accepted_at/,
  );
});

test("HP7 onboarding is a guided hub rather than a mandatory wizard", () => {
  assert.match(onboardingPage, /Guided company setup/);
  assert.match(onboardingPage, /senza bloccare il lavoro/);
  assert.match(onboardingPage, /Entra nel workspace/);
  assert.match(onboardingPage, /Setup essenziale/);
  assert.match(onboardingPage, /Primo valore/);
  assert.match(onboardingPage, /Importa il primo documento/);
  assert.doesNotMatch(onboardingPage, /step=\{complete \? "Workspace attivo" : "2 di 2"\}/);
});

test("HP7 derives setup mutations from the active admin workspace", () => {
  assert.match(onboardingActions, /requireWorkspaceAdmin/);
  assert.match(onboardingActions, /p_organization_id: context\.organizationId/);
  assert.doesNotMatch(
    onboardingActions,
    /String\(formData\.get\("organization_id"\)/,
  );
});

test("HP7 keeps setup visible in the workspace and company menu", () => {
  assert.match(dashboard, /HP7 · Avvio workspace/);
  assert.match(dashboard, /setup\.profile_ready/);
  assert.match(dashboard, /setup\.data_ready/);
  assert.match(dashboard, /setup\.first_value_ready/);
  assert.match(routes, /setup: "\/onboarding"/);
  assert.match(navigation, /Setup azienda/);
});
