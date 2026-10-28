import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const analysisHub = fs.readFileSync(new URL("../app/(italian)/(workspace)/commercial/analysis/page.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const marketplace = fs.readFileSync(new URL("../app/(workspace)/marketplace/page.tsx", import.meta.url), "utf8");
const knowledge = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");
const sharedSchool = fs.readFileSync(new URL("../components/school-unified-experience.tsx", import.meta.url), "utf8");
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
  assert.match(analysisHub, /appRoutes\.commercial\.products/);
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
  assert.match(knowledge, /L’acciaio, spiegato bene/);
  assert.match(knowledge, /id="school-tools-heading"/);
  assert.match(knowledge, /id="school-search-heading"/);
  assert.match(knowledge, /id="school-articles-heading"/);
  assert.match(knowledge, /SchoolJourney locale="it"/);
  assert.match(sharedSchool, /href:"\/knowledge\/norme"/);
  assert.match(sharedSchool, /href:"\/knowledge\/gradi"/);
  assert.match(knowledge, /schoolArticles\.slice\(0, 3\)/);
  assert.match(knowledge, /accesso gratuito/);
  assert.match(knowledgeLayout, /PublicSessionAction/);
  assert.match(publicSessionAction, /authenticated \? "Workspace" : "Accedi"/);
  assert.match(knowledgeLayout, /Trova azienda/);
  assert.match(knowledgeLayout, /\/knowledge\/articoli/);
  assert.doesNotMatch(knowledge + knowledgeLayout, /getWorkspaceContext|requireWorkspace|redirect\("\/login"\)/);
});

test("UXA1 propagates the forest-neutral system through shared primitives", () => {
  assert.match(globals, /--primary: var\(--brand-primary\)/);
  assert.match(globals, /--brand-primary: #1f6b5a/);
  assert.match(button, /ui-action-primary/);
  assert.match(globals, /\.ui-action-primary\s*\{/);
  assert.match(globals, /\.ui-action-primary:hover\s*\{/);
  assert.match(input, /border-\[var\(--border\)\]/);
  assert.match(input, /focus:ring-4 focus:ring-\[var\(--steel-blue-soft\)\]/);
});
