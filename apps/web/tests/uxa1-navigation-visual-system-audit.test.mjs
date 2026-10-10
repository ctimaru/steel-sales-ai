import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

const routes = fs.readFileSync(
  new URL("../lib/routes.ts", import.meta.url),
  "utf8",
);
const appShell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const workspaceNav = fs.readFileSync(
  new URL("../components/workspace-navigation.tsx", import.meta.url),
  "utf8",
);
const platformNav = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);
const platformShell = fs.readFileSync(
  new URL("../components/platform-shell.tsx", import.meta.url),
  "utf8",
);
const knowledgeLayout = fs.readFileSync(
  new URL("../app/(public)/knowledge/layout.tsx", import.meta.url),
  "utf8",
);
const assistantPage = fs.readFileSync(
  new URL("../app/(workspace)/assistant/page.tsx", import.meta.url),
  "utf8",
);
const publicSessionAction = fs.readFileSync(
  new URL("../components/public-session-action.tsx", import.meta.url),
  "utf8",
);
const globals = fs.readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const productBrand = fs.readFileSync(
  new URL("../components/product-brand.tsx", import.meta.url),
  "utf8",
);

test("UXA1 exposes previously orphaned daily analysis tools", () => {
  for (const routeKey of [
    "explorer",
    "priceIntelligence",
    "marketIntelligence",
    "knowledgeExplorer",
  ]) {
    assert.match(routes, new RegExp(routeKey + ":"));
  }

  assert.match(appShell, /Commercial Explorer|Explorer/);
  assert.match(appShell, /label: "Prezzi"/);
  assert.match(appShell, /label: "Mercato"/);
  assert.match(appShell, /label: "Documenti"/);
  assert.match(appShell, /label: "Calcolo pesi"/);
  assert.match(routes, /tubesStandards: "\/company\/tools\/tubi-norme"/);
});

test("UXA1 makes the Platform Console navigable on mobile", () => {
  assert.match(platformNav, /export function PlatformMobileNavigation/);
  assert.match(platformNav, /lg:hidden/);
  assert.match(platformNav, /getPlatformIaVisibleModules/);
  assert.match(platformShell, /<PlatformMobileNavigation/);
  assert.match(platformShell, /permissions={permissions}/);
  assert.match(platformShell, /isPlatformOwner={isPlatformOwner}/);
});

test("UXA1 keeps Platform navigation on canonical route constants", () => {
  assert.match(platformIa, /appRoutes\.platform\.home/);
  assert.match(platformIa, /appRoutes\.platform\.people/);
  assert.match(platformIa, /appRoutes\.platform\.registrations/);
  assert.match(platformIa, /appRoutes\.platform\.discovery/);
  assert.match(platformIa, /appRoutes\.platform\.claims/);
  assert.match(platformIa, /appRoutes\.platform\.knowledge/);
  assert.match(platformIa, /appRoutes\.platform\.networkTrust/);
});

test("UXA1 makes public Knowledge category navigation reachable on mobile", () => {
  assert.match(knowledgeLayout, /aria-label="Sezioni Scuola"/);
  assert.match(knowledgeLayout, /md:hidden/);
  assert.match(knowledgeLayout, /Pesi & dimensioni/);
  assert.match(knowledgeLayout, /PublicSessionAction/);
  assert.match(publicSessionAction, /authenticated \? "\/dashboard"/);
  assert.match(publicSessionAction, /"Accedi"/);
});

test("UXA1 prevents the commercial assistant from jumping to legacy URLs", () => {
  assert.match(assistantPage, /appRoutes\.commercial\.search/);
  assert.match(assistantPage, /appRoutes\.commercial\.products/);
  assert.doesNotMatch(assistantPage, /href="\/search"/);
  assert.doesNotMatch(assistantPage, /href="\/products"/);
});

test("UXA1 establishes the forest and neutral visual system in core chrome", () => {
  assert.match(globals, /--brand-deep: #123b34/);
  assert.match(globals, /--brand-primary: #1f6b5a/);
  assert.match(globals, /--surface-canvas: #f6f8f7/);
  assert.match(globals, /--border: #dde4e1/);
  assert.match(globals, /UXA1 — legacy accent compatibility/);
  assert.match(productBrand, /#123B34/);

  for (const source of [appShell, workspaceNav, platformNav, platformShell]) {
    assert.doesNotMatch(source, /#2f6fed/i);
  }
});
