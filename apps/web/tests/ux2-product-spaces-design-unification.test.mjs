import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const marketplace = fs.readFileSync(new URL("../app/(workspace)/marketplace/page.tsx", import.meta.url), "utf8");
const knowledge = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");
const knowledgeLayout = fs.readFileSync(new URL("../app/(public)/knowledge/layout.tsx", import.meta.url), "utf8");
const publicSessionAction = fs.readFileSync(new URL("../components/public-session-action.tsx", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../components/ui/button.tsx", import.meta.url), "utf8");
const input = fs.readFileSync(new URL("../components/ui/input.tsx", import.meta.url), "utf8");

test("UXA2 exposes five stable macro destinations over the product spaces", () => {
  for (const label of ["Home", "Commerciale", "Network", "Marketplace", "Scuola"]) {
    assert.match(nav, new RegExp(`label: "${label}"`));
  }
  assert.match(routes, /home: "\/commercial"/);
  assert.match(routes, /marketplace:\s*\{/);
  assert.match(routes, /knowledge:\s*\{/);
  assert.match(nav, /WorkspaceMobileBottomNavigation/);
});

test("PF1 keeps Commercial Memory private while Home becomes a daily cockpit", () => {
  assert.match(shell, /WorkspaceSearchBar/);
  assert.match(shell, /appRoutes\.commercial\.products/);
  assert.match(shell, /appRoutes\.commercial\.companies/);

  assert.match(dashboard, /Workspace privato/);
  assert.match(dashboard, /Ultimi movimenti commerciali/);
  assert.match(dashboard, /Cerca nello storico/);
  assert.doesNotMatch(dashboard, /Operations e configurazione/);
  assert.doesNotMatch(dashboard, /<form action=\{appRoutes\.commercial\.search\}/);
});

test("PF4 Marketplace separates buyer and supplier jobs without internal program language", () => {
  assert.match(marketplace, /Compra o vendi, in un unico spazio/);
  assert.match(marketplace, /Chiedi offerte a più fornitori/);
  assert.match(marketplace, /Trova richieste a cui puoi rispondere/);
  assert.match(marketplace, /Apri RFQ Hub/);
  assert.match(marketplace, /Opportunità per te/);
  assert.match(marketplace, /getMarketplaceFeed/);
  assert.doesNotMatch(marketplace, /P5\.|Free teaser|Demand Board|foundation/i);
});

test("K1 Knowledge is a public technical discovery surface", () => {
  assert.match(knowledge, /Conoscenza tecnica per chi lavora con acciaio e tubi/);
  assert.match(knowledge, /Norme/);
  assert.match(knowledge, /Gradi di acciaio/);
  assert.match(knowledge, /Pesi & dimensioni/);
  assert.match(knowledge, /href: "\/knowledge\/norme"/);
  assert.match(knowledge, /href: "\/knowledge\/gradi"/);
  assert.match(knowledge, /Articoli/);
  assert.match(knowledge, /Pubblico/);
  assert.match(knowledgeLayout, /PublicSessionAction/);
  assert.match(publicSessionAction, /authenticated \? "Workspace" : "Accedi"/);
  assert.match(knowledgeLayout, /Trova azienda/);
  assert.match(knowledgeLayout, /\/knowledge\/articoli/);
  assert.doesNotMatch(knowledge + knowledgeLayout, /getWorkspaceContext|requireWorkspace|redirect\("\/login"\)/);
});

test("UXA1 propagates the forest-neutral system through shared primitives", () => {
  assert.match(globals, /--primary: var\(--brand-primary\)/);
  assert.match(globals, /--brand-primary: #1f6b5a/);
  assert.match(button, /bg-\[var\(--brand-primary\)\]/);
  assert.match(button, /hover:bg-\[var\(--brand-primary-hover\)\]/);
  assert.match(input, /border-\[var\(--border\)\]/);
  assert.match(input, /focus:ring-4 focus:ring-\[var\(--steel-blue-soft\)\]/);
});
