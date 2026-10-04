import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const marketplace = fs.readFileSync(new URL("../app/(workspace)/marketplace/page.tsx", import.meta.url), "utf8");
const knowledge = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");
const knowledgeLayout = fs.readFileSync(new URL("../app/(public)/knowledge/layout.tsx", import.meta.url), "utf8");
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

test("UXA2 keeps Commercial Memory private while search becomes a persistent header utility", () => {
  assert.match(shell, /WorkspaceSearchBar/);
  assert.match(shell, /appRoutes\.commercial\.products/);
  assert.match(shell, /appRoutes\.commercial\.companies/);

  assert.match(dashboard, /Commercial Memory privata/);
  assert.match(dashboard, /Oggi nel workspace/);
  assert.match(dashboard, /Operations e configurazione/);
  assert.doesNotMatch(dashboard, /<form action=\{appRoutes\.commercial\.search\}/);
});

test("P5.2 Marketplace is a supplier Demand Board without implying unlock or response rights", () => {
  assert.match(marketplace, /P5\.2 · Live Demand Board/);
  assert.match(marketplace, /Opportunità dal Network/);
  assert.match(marketplace, /Free teaser/);
  assert.match(marketplace, /getMarketplaceFeed/);
  assert.match(marketplace, /Dettagli tecnici completi e risposta restano fuori da P5\.2/);
  assert.doesNotMatch(marketplace, /Pay to see/);
  assert.doesNotMatch(marketplace, /supplier interessato può rispondere/i);
});

test("K1 Knowledge is a public technical discovery surface", () => {
  assert.match(knowledge, /Conoscenza tecnica per chi lavora con acciaio e tubi/);
  assert.match(knowledge, /Norme/);
  assert.match(knowledge, /Gradi di acciaio/);
  assert.match(knowledge, /Pesi & dimensioni/);
  assert.match(knowledge, /href: "\/knowledge\/norme"/);
  assert.match(knowledge, /href: "\/knowledge\/gradi"/);
  assert.match(knowledge, /Guide tecniche/);
  assert.match(knowledge, /Pubblico/);
  assert.match(knowledgeLayout, /Apri workspace/);
  assert.match(knowledgeLayout, /Trova azienda/);
  assert.doesNotMatch(knowledge + knowledgeLayout, /getWorkspaceContext|requireWorkspace|redirect\("\/login"\)/);
});

test("UXA1 propagates the forest-neutral system through shared primitives", () => {
  assert.match(globals, /--primary: #1a5144/);
  assert.match(globals, /--brand-700: #226657/);
  assert.match(button, /bg-\[#1a5144\]/);
  assert.match(button, /hover:bg-\[#226657\]/);
  assert.match(input, /border-\[#d7dfdb\]/);
  assert.match(input, /focus:ring-4 focus:ring-\[#e1ece8\]/);
});
