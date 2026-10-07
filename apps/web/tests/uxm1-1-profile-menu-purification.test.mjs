import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const nav = fs.readFileSync(
  new URL("../components/workspace-navigation.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const workspaceLayout = fs.readFileSync(
  new URL("../app/(workspace)/layout.tsx", import.meta.url),
  "utf8",
);
const workspaceContext = fs.readFileSync(
  new URL("../lib/workspace-context.ts", import.meta.url),
  "utf8",
);
const platformAdmin = fs.readFileSync(
  new URL("../lib/platform-admin.ts", import.meta.url),
  "utf8",
);
const dashboard = fs.readFileSync(
  new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url),
  "utf8",
);
const dataSources = fs.readFileSync(
  new URL("../app/(workspace)/data-sources/page.tsx", import.meta.url),
  "utf8",
);

test("UXM1.1 removes operational actions from the profile drawer", () => {
  const start = nav.indexOf("export function WorkspaceProfileMenu");
  const menu = nav.slice(start);

  assert.doesNotMatch(menu, /Workspace\s*<\/p>/);
  assert.doesNotMatch(menu, /label="Importa documenti"/);
  assert.doesNotMatch(menu, /label="Revisioni dati"/);
  assert.match(menu, /Profilo azienda/);
  assert.match(menu, /Team e accessi/);
  assert.match(menu, /Dati e fonti/);
  assert.match(menu, /Account e privacy/);
});

test("UXM1.1 keeps import reachable from data sources and first-use home states", () => {
  assert.match(dataSources, /appRoutes\.operations\.uploads/);
  assert.match(dataSources, /Importa documenti/);
  assert.match(dataSources, /appRoutes\.company\.dataSources/);
  assert.match(dashboard, /appRoutes\.operations\.uploads/);
});

test("UXM1.1 keeps review contextual instead of permanently duplicating it in the avatar menu", () => {
  assert.match(dashboard, /metrics\.reviewFlags > 0/);
  assert.match(dashboard, /href: appRoutes\.operations\.review/);
  assert.match(dashboard, /Elementi da verificare/);
  assert.doesNotMatch(nav.slice(nav.indexOf("export function WorkspaceProfileMenu")), /Revisioni dati/);
});

test("UXM1.1 hides Platform administration unless the authenticated identity has console permission", () => {
  assert.match(workspaceContext, /supabase\.auth\.getUser\(\)/);
  assert.match(workspaceContext, /if \(!user\) redirect\("\/login"\)/);
  assert.match(workspaceContext, /platformAccessError/);
  assert.match(workspaceContext, /platformAccess\?\.user_id === user\.id/);
  assert.match(workspaceContext, /permissions\?\.includes\("platform\.console\.access"\)/);
  assert.match(workspaceLayout, /platformConsoleAccess = context\.platformConsoleAccess/);
  assert.match(shell, /platformConsoleAccess/);
  assert.match(shell, /label="Console piattaforma"/);
  assert.match(shell, /appRoutes\.platform\.home/);
  assert.doesNotMatch(nav, /Amministrazione Smart Steel Sales/);
  assert.doesNotMatch(nav, /Apri Console piattaforma/);
  assert.doesNotMatch(shell, /platformSuperadmin/);
});

test("UXM1.1 Platform route independently verifies login, identity and permission server-side", () => {
  assert.match(platformAdmin, /auth\.getUser\(\)/);
  assert.match(platformAdmin, /if \(authError \|\| !user\) redirect\("\/login"\)/);
  assert.match(platformAdmin, /context\.user_id !== user\.id/);
  assert.match(platformAdmin, /context\.permissions\.includes\("platform\.console\.access"\)/);
});
