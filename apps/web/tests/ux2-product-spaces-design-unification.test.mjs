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

test("UX2 defines four distinct product spaces", () => {
  for (const label of ["Home Workspace", "Network", "Marketplace", "Knowledge"]) {
    assert.match(nav, new RegExp(label));
  }
  assert.match(nav, /Privato/);
  assert.match(nav, /Condiviso/);
  assert.match(nav, /Pubblico/);
  assert.match(routes, /marketplace:\s*\{/);
  assert.match(routes, /knowledge:\s*\{/);
});

test("UX2 keeps Commercial Memory private and moves search below primary workspace actions", () => {
  const products = shell.indexOf('href: appRoutes.commercial.products');
  const companies = shell.indexOf('href: appRoutes.commercial.companies');
  const search = shell.indexOf('href: appRoutes.commercial.search');
  assert.ok(products >= 0 && companies >= 0 && search > products && search > companies);

  assert.match(dashboard, /Commercial Memory privata/);
  assert.match(dashboard, /Oggi nel workspace/);
  assert.match(dashboard, /Operations e configurazione/);
  assert.doesNotMatch(dashboard, /<form action=\{appRoutes\.commercial\.search\}/);
});

test("UX2 Marketplace is visible but cannot imply a live transaction workflow", () => {
  assert.match(marketplace, /Prossima priorità/);
  assert.match(marketplace, /Richiesta prodotto/);
  assert.match(marketplace, /Visibile o anonima/);
  assert.match(marketplace, /Countdown/);
  assert.match(marketplace, /Pay to see \/ unlock/);
  assert.match(marketplace, /Nessuna richiesta viene pubblicata o sbloccata/);
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
  assert.match(knowledgeLayout, /Accedi/);
  assert.match(knowledgeLayout, /Registra azienda/);
  assert.doesNotMatch(knowledge + knowledgeLayout, /getWorkspaceContext|requireWorkspace|redirect\("\/login"\)/);
});

test("UX2 propagates the light steel-blue system through shared primitives", () => {
  assert.match(globals, /--primary: #2f6fed/);
  assert.match(globals, /--brand-700: #245ed1/);
  assert.match(button, /bg-\[#2f6fed\]/);
  assert.match(button, /hover:bg-\[#245ed1\]/);
  assert.match(input, /border-\[#dbe5f1\]/);
  assert.match(input, /focus:ring-4 focus:ring-\[#eaf2ff\]/);
});
