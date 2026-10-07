import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const switchLink = fs.readFileSync(
  new URL("../components/context-switch-link.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const nav = fs.readFileSync(
  new URL("../components/workspace-navigation.tsx", import.meta.url),
  "utf8",
);
const platformShell = fs.readFileSync(
  new URL("../components/platform-shell.tsx", import.meta.url),
  "utf8",
);
const context = fs.readFileSync(
  new URL("../lib/workspace-context.ts", import.meta.url),
  "utf8",
);

test("UXM1.2 renders Platform as a persistent workspace context switch", () => {
  assert.match(shell, /ContextSwitchLink/);
  assert.match(shell, /href=\{appRoutes\.platform\.home\}/);
  assert.match(shell, /label="Console piattaforma"/);
  assert.match(shell, /label="Console"/);
  assert.match(shell, /\{platformConsoleAccess \? \(/);
});

test("UXM1.2 removes Platform administration from the avatar drawer", () => {
  const menu = nav.slice(nav.indexOf("export function WorkspaceProfileMenu"));
  assert.doesNotMatch(menu, /Amministrazione Smart Steel Sales/);
  assert.doesNotMatch(menu, /Apri Console piattaforma/);
  assert.doesNotMatch(menu, /Platform Owner/);
  assert.doesNotMatch(menu, /Platform Staff/);
});

test("UXM1.2 keeps the switch permission-gated after authenticated login", () => {
  assert.match(context, /supabase\.auth\.getUser\(\)/);
  assert.match(context, /platformAccess\?\.user_id === user\.id/);
  assert.match(context, /permissions\?\.includes\("platform\.console\.access"\)/);
  assert.match(shell, /platformConsoleAccess: boolean/);
});

test("UXM1.2 uses the same visual switch component in both directions", () => {
  assert.match(platformShell, /ContextSwitchLink/);
  assert.match(platformShell, /label="Torna al workspace aziendale"/);
  assert.match(platformShell, /label="Workspace aziendale"/);
  assert.match(switchLink, /border-\[#d7dfdb\]/);
  assert.match(switchLink, /hover:bg-\[#f0f4f2\]/);
  assert.match(switchLink, /↗/);
});

test("UXM1.2 switches context in the same browser tab", () => {
  assert.match(switchLink, /<Link/);
  assert.doesNotMatch(switchLink, /target="_blank"/);
});
