import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const appShell = read("../components/app-shell.tsx");
const clientNav = read("../components/workspace-navigation.tsx");
const serverSearch = read("../components/workspace-search-bar.tsx");
const browser = read("./comm-ux1-chrome-auth.mjs");

test("COMM-NAV7.FIX keeps search as static server component outside client hydration", () => {
  assert.doesNotMatch(serverSearch, /^["']use client["']/m);
  assert.doesNotMatch(clientNav, /export function WorkspaceSearchBar/);
  assert.match(appShell, /import \{ WorkspaceSearchBar \} from "@\/components\/workspace-search-bar"/);
  assert.match(appShell, /<WorkspaceSearchBar \/>/);
  assert.match(serverSearch, /action=\{appRoutes\.commercial\.search\}/);
  assert.match(serverSearch, /name="q"/);
  assert.match(serverSearch, /type="search"/);
  assert.match(serverSearch, /aria-label="Cerca nello storico commerciale"/);
  assert.match(serverSearch, /minLength=\{2\}/);
  assert.match(serverSearch, /maxLength=\{160\}/);
  assert.match(serverSearch, /required/);
});

test("COMM-NAV7.FIX diagnosis remains enforced on authenticated synthetic mobile", () => {
  assert.match(browser, /inspectNextDevIndicator\(page\)/);
  assert.match(browser, /openNextDevIssueAndRead\(page\)/);
  assert.match(browser, /assert\.ok\(!issue/);
  assert.match(browser, /Only throwaway local Next allowed/);
  assert.doesNotMatch(serverSearch, /suppressHydrationWarning/);
  assert.doesNotMatch(serverSearch, /display:\s*none|visibility:\s*hidden/);
});
