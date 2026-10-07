import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/(workspace)/layout.tsx", import.meta.url), "utf8");
const context = fs.readFileSync(new URL("../lib/workspace-context.ts", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../app/onboarding/actions.ts", import.meta.url), "utf8");
const team = fs.readFileSync(new URL("../app/(workspace)/company/team/page.tsx", import.meta.url), "utf8");
const platformShell = fs.readFileSync(new URL("../components/platform-shell.tsx", import.meta.url), "utf8");

test("UXM1 gives team management a canonical company route", () => {
  assert.match(routes, /team: "\/company\/team"/);
  assert.match(team, /hp8_team_state/);
  assert.match(team, /return_to/);
  assert.match(team, /Team e accessi/);
  assert.match(actions, /revalidatePath\("\/company\/team"\)/);
});

test("UXM1 keeps the avatar drawer focused on company, account and privileged Platform settings", () => {
  const start = nav.indexOf("export function WorkspaceProfileMenu");
  const menu = nav.slice(start);

  assert.doesNotMatch(menu, /Importa documenti/);
  assert.doesNotMatch(menu, /Revisioni dati/);
  assert.match(menu, /Profilo azienda/);
  assert.match(menu, /Team e accessi/);
  assert.match(menu, /Dati e fonti/);
  assert.match(menu, /Account e privacy/);
  assert.doesNotMatch(menu, /Pilot analytics/);
  assert.doesNotMatch(menu, /Strumenti tubi & norme/);
  assert.doesNotMatch(menu, /Alert operativi/);
});

test("UXM1 only promotes guided setup while it is incomplete", () => {
  assert.match(nav, /!guidedSetupComplete/);
  assert.match(nav, /Completa setup azienda/);
  assert.match(shell, /guidedSetupComplete/);
  assert.match(layout, /guidedSetupComplete = context\.guidedSetupComplete/);
});

test("UXM1 uses Platform permission context instead of company admin role", () => {
  assert.match(context, /platform_access_context/);
  assert.match(context, /platform\.console\.access/);
  assert.match(context, /platformConsoleAccess/);
  assert.match(nav, /platformConsoleAccess/);
  assert.match(nav, /Amministrazione Smart Steel Sales/);
  assert.match(nav, /Ambiente separato dal workspace aziendale/);
  assert.match(nav, /Apri Console piattaforma/);
});

test("UXM1 preserves the server-side Platform boundary and provides an explicit return path", () => {
  assert.match(platformShell, /Torna al workspace aziendale/);
  assert.match(platformShell, /Amministrazione piattaforma/);
  assert.match(platformShell, /Console piattaforma/);
});

test("UXM1 hides generated legacy workspace names from the profile identity", () => {
  assert.match(shell, /\^Steel Sales AI workspace/);
  assert.match(shell, /Smart Steel Sales · Workspace/);
  assert.match(shell, /Amministratore azienda/);
});
