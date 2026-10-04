import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const workspaceLayout = fs.readFileSync(new URL("../app/(workspace)/layout.tsx", import.meta.url), "utf8");
const companyShell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const companyHome = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const platformLayout = fs.readFileSync(new URL("../app/(platform)/platform/layout.tsx", import.meta.url), "utf8");
const platformShell = fs.readFileSync(new URL("../components/platform-shell.tsx", import.meta.url), "utf8");
const platformHome = fs.readFileSync(new URL("../app/(platform)/platform/page.tsx", import.meta.url), "utf8");
const legacyAdmin = fs.readFileSync(new URL("../app/(workspace)/admin/registrations/page.tsx", import.meta.url), "utf8");

test("UX1 separates public, company and platform entry points", () => {
  assert.match(root, /Trova o rivendica la tua azienda/);
  assert.match(root, /if \(data\.user\) redirect\("\/dashboard"\)/);
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
  assert.match(companyShell, /platformSuperadmin/);
});

test("UX2 Company Home is a private operational cockpit with shared-space exits", () => {
  assert.match(companyHome, /Il centro operativo della tua azienda/);
  assert.match(companyHome, /Area privata aziendale/);
  assert.match(companyHome, /Oggi nel workspace/);
  assert.match(companyHome, /Spazi condivisi/);
  assert.match(companyHome, /Marketplace/);
  assert.match(companyHome, /Scuola/);
  assert.match(companyHome, /getWorkspaceContext/);
  assert.doesNotMatch(companyHome, /<form action=\{appRoutes\.commercial\.search\}/);
});

test("UX1 Platform Console is structurally separate from tenant workspace", () => {
  assert.match(platformShell, /Global control plane/);
  assert.match(platformShell, /Apri Company Workspace/);
  assert.match(platformShell, /Commercial Memory privata dei tenant/);
  assert.match(platformHome, /Governance della piattaforma/);
  assert.match(platformHome, /Registrazioni aziende/);
  assert.doesNotMatch(platformShell, /Product 360/);
  assert.doesNotMatch(platformShell, /Importa documenti/);
});

test("UX1 legacy admin entry redirects to Platform Console", () => {
  assert.match(legacyAdmin, /redirect\("\/platform\/registrations"\)/);
});
