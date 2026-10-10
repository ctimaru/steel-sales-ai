import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const proxy = fs.readFileSync(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8");
const workspaceLayout = fs.readFileSync(new URL("../app/(workspace)/layout.tsx", import.meta.url), "utf8");
const companyShell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const companyHome = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const platformLayout = fs.readFileSync(new URL("../app/(platform)/platform/layout.tsx", import.meta.url), "utf8");
const platformShell = fs.readFileSync(new URL("../components/platform-shell.tsx", import.meta.url), "utf8");
const platformHome = fs.readFileSync(new URL("../app/(platform)/platform/page.tsx", import.meta.url), "utf8");
const legacyAdmin = fs.readFileSync(new URL("../app/(workspace)/admin/registrations/page.tsx", import.meta.url), "utf8");

test("UX1 separates public, company and platform entry points", () => {
  assert.match(root, /Trova o rivendica la tua azienda/);
  assert.match(root, /export const dynamic = "force-static"/);
  assert.match(proxy, /if \(!error && data\.user\)/);
  assert.match(proxy, /target\.pathname = "\/dashboard"/);
  assert.match(workspaceLayout, /getWorkspaceContext/);
  assert.match(platformLayout, /requirePlatformConsoleContext/);
  assert.doesNotMatch(platformLayout, /getWorkspaceContext/);
});

test("UXA2 Company Workspace exposes role-aware LinkedIn-style macro navigation", () => {
  assert.match(companyShell, /WorkspaceDesktopPrimaryNavigation/);
  assert.match(companyShell, /WorkspaceMobileBottomNavigation/);
  assert.match(companyShell, /WorkspaceContextNavigation/);
  assert.match(companyShell, /WorkspaceProfileMenu/);
  assert.match(companyShell, /organizationRole/);
  assert.match(companyShell, /canAdministerCompany/);
  assert.match(companyShell, /canWriteWorkspace/);
  assert.match(companyShell, /platformConsoleAccess/);
  assert.doesNotMatch(companyShell, /platformSuperadmin/);
});

test("PF1 Company Home is a private daily cockpit with task-oriented exits", () => {
  assert.match(companyHome, /Oggi in/);
  assert.match(companyHome, /Workspace privato/);
  assert.match(companyHome, /Cosa richiede attenzione/);
  assert.match(companyHome, /Ultimi movimenti commerciali/);
  assert.match(companyHome, /Azioni rapide/);
  assert.match(companyHome, /appRoutes\.marketplace\.rfqHub/);
  assert.match(companyHome, /appRoutes\.network\.directory/);
  assert.match(companyHome, /getWorkspaceContext/);
  assert.doesNotMatch(companyHome, /Spazi condivisi/);
  assert.doesNotMatch(companyHome, /<form action=\{appRoutes\.commercial\.search\}/);
});

test("UX1 Platform Console is structurally separate from tenant workspace", () => {
  assert.match(platformShell, /Governance Smart Steel Sales/);
  assert.match(platformShell, /Torna al workspace aziendale/);
  assert.match(platformShell, /dati commerciali delle aziende restano separati/);
  assert.match(platformHome, /Governance della piattaforma/);
  assert.match(platformHome, /Registrazioni aziende/);
  assert.doesNotMatch(platformShell, /Product 360/);
  assert.doesNotMatch(platformShell, /Importa documenti/);
});

test("UX1 legacy admin entry redirects to Platform Console", () => {
  assert.match(legacyAdmin, /redirect\("\/platform\/registrations"\)/);
});
