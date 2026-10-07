import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const appShell = read("../components/app-shell.tsx");
const workspaceNav = read("../components/workspace-navigation.tsx");
const platformShell = read("../components/platform-shell.tsx");
const knowledgeLayout = read("../app/(public)/knowledge/layout.tsx");
const focusUi = read("../components/focus-ui.tsx");
const globals = read("../app/globals.css");
const card = read("../components/ui/card.tsx");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");
const commercial = read("../app/(workspace)/commercial/page.tsx");
const network = read("../app/(workspace)/network/page.tsx");
const marketplace = read("../app/(workspace)/marketplace/page.tsx");
const school = read("../app/(workspace)/school/page.tsx");
const publicSchool = read("../app/(public)/knowledge/page.tsx");
const login = read("../app/login/page.tsx");
const register = read("../app/register/page.tsx");
const home = read("../app/page.tsx");

test("UXF1 constrains the shared application shells", () => {
  assert.match(appShell, /mvp-focus-shell/);
  assert.match(appShell, /max-w-\[1280px\]/);
  assert.match(workspaceNav, /max-w-\[1280px\]/);
  assert.match(platformShell, /mvp-focus-shell/);
  assert.match(platformShell, /max-w-\[1280px\]/);
  assert.match(knowledgeLayout, /mvp-focus-shell/);
  assert.match(knowledgeLayout, /max-w-\[1180px\]/);
});

test("UXF1 provides a reusable focused-page contract", () => {
  assert.match(focusUi, /export function FocusPage/);
  assert.match(focusUi, /export function FocusHeader/);
  assert.match(focusUi, /export function FocusPanel/);
  assert.match(focusUi, /export function FocusLink/);
  assert.match(globals, /UXF1 — MVP focus system/);
});

test("UXF1 flattens global visual elevation", () => {
  assert.doesNotMatch(card, /shadow-\[/);
  assert.match(globals, /box-shadow: none !important/);
});

test("UXF1 focuses the main workspace entry points", () => {
  for (const source of [dashboard, commercial, network, marketplace, school]) {
    assert.match(source, /FocusPage/);
  }
  assert.match(commercial, /Cerca nella Commercial Memory/);
  assert.match(network, /Trova aziende steel/);
  assert.match(marketplace, /title="Compra o vendi, in un unico spazio"/);
  assert.match(school, /Strumento principale/);
});

test("UXF1 makes public School calculator-first and progressive", () => {
  assert.match(publicSchool, /Strumento principale/);
  assert.match(publicSchool, /Calcola peso, barre e tonnellate/);
  assert.match(publicSchool, /<details/);
});

test("UXF1 removes split-screen distraction from auth entry", () => {
  assert.doesNotMatch(login, /lg:grid-cols-\[1\.02fr_0\.98fr\]/);
  assert.match(login, /max-w-lg/);
  assert.match(register, /max-w-3xl/);
  assert.doesNotMatch(register, /lg:sticky lg:top-6/);
});

test("UXF1 makes the public homepage utility-first", () => {
  assert.match(home, /con strumenti che usi davvero/);
  assert.match(home, /Calcolo pesi/);
  assert.match(home, /max-w-\[1120px\]/);
});
