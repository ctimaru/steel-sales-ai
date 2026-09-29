import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const nav = fs.readFileSync(
  new URL("../components/workspace-navigation.tsx", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(
  new URL("../lib/routes.ts", import.meta.url),
  "utf8",
);
const commercialHome = fs.readFileSync(
  new URL("../app/(workspace)/commercial/page.tsx", import.meta.url),
  "utf8",
);
const knowledgeHome = fs.readFileSync(
  new URL("../app/(workspace)/knowledge-center/page.tsx", import.meta.url),
  "utf8",
);
const globals = fs.readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

test("UXA2 replaces the global sidebar with LinkedIn-inspired primary navigation", () => {
  assert.doesNotMatch(shell, /<aside className="fixed inset-y-0 left-0/);
  assert.match(shell, /WorkspaceDesktopPrimaryNavigation/);
  assert.match(shell, /WorkspaceMobileBottomNavigation/);
  assert.match(shell, /WorkspaceContextNavigation/);
  assert.match(shell, /WorkspaceSearchBar/);
  assert.match(shell, /WorkspaceProfileMenu/);
});

test("UXA2 freezes five primary macro destinations when Network is enabled", () => {
  for (const label of ["Home", "Commerciale", "Network", "Marketplace", "Knowledge"]) {
    assert.match(nav, new RegExp(`label: "${label}"`));
  }

  assert.match(nav, /fixed inset-x-0 bottom-0/);
  assert.match(nav, /flex min-h-\[62px\] flex-col items-center justify-center/);
  assert.match(nav, /NavIcon name=\{item\.icon\}/);
  assert.match(nav, /mobileLabel: "Mercato"/);
  assert.match(nav, /aria-label="Navigazione mobile principale"/);
});

test("UXA2 desktop primary navigation uses icons plus labels and active underline", () => {
  assert.match(nav, /aria-label="Navigazione principale"/);
  assert.match(nav, /flex min-w-\[88px\] flex-col items-center/);
  assert.match(nav, /absolute inset-x-2 bottom-0 h-0\.5/);
});

test("UXA2 keeps daily search and alerts in the top header", () => {
  assert.match(nav, /placeholder="Cerca"/);
  assert.match(nav, /action=\{appRoutes\.commercial\.search\}/);
  assert.match(shell, /WorkspaceAlertsButton/);
  assert.match(nav, /Alert operativi/);
});

test("UXA2 moves operations, company controls and Platform into the avatar drawer", () => {
  assert.match(nav, /fixed inset-y-0 left-0/);
  assert.match(nav, /Operazioni/);
  assert.match(nav, /Importa documenti/);
  assert.match(nav, /Correzioni/);
  assert.match(nav, /Azienda/);
  assert.match(nav, /Profilo azienda/);
  assert.match(nav, /Fonti e import/);
  assert.match(nav, /Platform Console/);
  assert.match(nav, /Esci/);

  assert.doesNotMatch(shell, /mobileMore/);
  assert.doesNotMatch(shell, /WorkspaceSpaceNavigation/);
  assert.doesNotMatch(shell, /WorkspaceMobileSpaceTabs/);
});

test("UXA2 makes Commerciale a first-class landing instead of a random child route", () => {
  assert.match(routes, /home: "\/commercial"/);
  assert.match(nav, /href: appRoutes\.commercial\.home/);
  assert.match(nav, /href: appRoutes\.knowledge\.workspace/);
  assert.match(commercialHome, /Memoria, ricerca e intelligence commerciale/);
  assert.match(commercialHome, /Cerca nello storico/);
  assert.match(commercialHome, /Product 360/);
  assert.match(commercialHome, /Company 360/);
  assert.match(commercialHome, /Price Intelligence/);
  assert.match(commercialHome, /Market Intelligence/);
  assert.match(knowledgeHome, /Conoscenza aziendale e Steel Knowledge/);
  assert.match(knowledgeHome, /Knowledge Explorer/);
  assert.match(knowledgeHome, /Steel Knowledge/);
});

test("UXA2 keeps contextual subnavigation scoped to the active macro-space", () => {
  assert.match(nav, /currentPrimarySpace/);
  assert.match(nav, /current === "network"/);
  assert.match(nav, /current === "knowledge"/);
  assert.match(nav, /current === "commercial"/);
  assert.match(nav, /Intelligence/);
  assert.match(shell, /commercialItems=\{commercialItems\}/);
  assert.match(shell, /networkItems=\{networkItems\}/);
  assert.match(shell, /knowledgeItems=\{knowledgeItems\}/);
});

test("UXA2 preserves the forest-neutral visual baseline", () => {
  assert.match(globals, /--brand-950: #0b2f27/);
  assert.match(globals, /--primary: #1a5144/);
  assert.doesNotMatch(shell + nav, /#2f6fed|#245ed1/i);
});
