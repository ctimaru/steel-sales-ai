import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

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
  assert.match(appShell, /Price Intelligence/);
  assert.match(appShell, /Market Intelligence/);
  assert.match(appShell, /Knowledge Explorer/);
  assert.match(workspaceNav, /Strumenti tubi & norme/);
});

test("UXA1 makes the Platform Console navigable on mobile", () => {
  assert.match(platformNav, /export function PlatformMobileNavigation/);
  assert.match(platformNav, /lg:hidden/);
  assert.match(platformNav, /visiblePlatformItems/);
  assert.match(platformShell, /<PlatformMobileNavigation/);
  assert.match(platformShell, /permissions={permissions}/);
  assert.match(platformShell, /isPlatformOwner={isPlatformOwner}/);
});

test("UXA1 keeps Platform navigation on canonical route constants", () => {
  assert.match(platformNav, /appRoutes\.platform\.home/);
  assert.match(platformNav, /appRoutes\.platform\.people/);
  assert.match(platformNav, /appRoutes\.platform\.registrations/);
  assert.match(platformNav, /appRoutes\.platform\.discovery/);
  assert.match(platformNav, /appRoutes\.platform\.claims/);
  assert.match(platformNav, /appRoutes\.platform\.knowledge/);
  assert.match(platformNav, /appRoutes\.platform\.networkTrust/);
});

test("UXA1 makes public Knowledge category navigation reachable on mobile", () => {
  assert.match(knowledgeLayout, /aria-label="Sezioni Steel Knowledge"/);
  assert.match(knowledgeLayout, /md:hidden/);
  assert.match(knowledgeLayout, /Pesi & dimensioni/);
  assert.match(knowledgeLayout, /href="\/dashboard"/);
});

test("UXA1 prevents the commercial assistant from jumping to legacy URLs", () => {
  assert.match(assistantPage, /appRoutes\.commercial\.search/);
  assert.match(assistantPage, /appRoutes\.commercial\.products/);
  assert.doesNotMatch(assistantPage, /href="\/search"/);
  assert.doesNotMatch(assistantPage, /href="\/products"/);
});

test("UXA1 establishes the forest and neutral visual system in core chrome", () => {
  assert.match(globals, /--brand-950: #0b2f27/);
  assert.match(globals, /--brand-800: #1a5144/);
  assert.match(globals, /--background: #f2f4f3/);
  assert.match(globals, /--border: #dce2df/);
  assert.match(globals, /UXA1 — legacy accent compatibility/);
  assert.match(productBrand, /#173f35/);

  for (const source of [appShell, workspaceNav, platformNav, platformShell]) {
    assert.doesNotMatch(source, /#2f6fed/i);
  }
});
