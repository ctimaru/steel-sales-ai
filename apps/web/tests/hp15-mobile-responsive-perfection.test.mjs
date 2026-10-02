import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const layout = read("../app/layout.tsx");
const manifest = read("../app/manifest.ts");
const globals = read("../app/globals.css");
const appShell = read("../components/app-shell.tsx");
const workspaceNav = read("../components/workspace-navigation.tsx");
const platformShell = read("../components/platform-shell.tsx");
const platformNav = read("../components/platform-navigation.tsx");
const confirm = read("../components/confirm-submit-button.tsx");
const platformPeople = read("../app/(platform)/platform/people/page.tsx");
const platformKnowledge = read("../app/(platform)/platform/knowledge/page.tsx");
const platformPilot = read("../app/(platform)/platform/pilot/page.tsx");
const discovery = read("../app/(platform)/platform/company-discovery/page.tsx");
const companyProfile = read("../app/(workspace)/network/manage/page.tsx");
const marketplaceNew = read("../app/(workspace)/marketplace/new/page.tsx");
const marketplaceResponse = read("../components/marketplace-response-workspace.tsx");

test("HP15 declares an edge-to-edge mobile viewport and installable web-app metadata", () => {
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /themeColor: "#f2f4f3"/);
  assert.match(layout, /appleWebApp:/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /name: "Smart Steel Sales"/);
  assert.match(manifest, /src: "\/icon\.svg"/);
});

test("HP15 prevents iOS form zoom and preserves touch-first controls", () => {
  assert.match(globals, /max-width: 767px/);
  assert.match(globals, /font-size: 16px/);
  assert.match(globals, /touch-action: manipulation/);
  assert.match(globals, /100dvh/);
});

test("HP15 reserves display cutouts and the workspace bottom navigation safe area", () => {
  assert.match(appShell, /pt-\[env\(safe-area-inset-top\)\]/);
  assert.match(appShell, /pb-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(workspaceNav, /pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(workspaceNav, /100dvh/);
  assert.match(workspaceNav, /safe-area-inset-top/);
});

test("HP15 makes Platform navigation and access controls fit narrow phones", () => {
  assert.match(platformShell, /pt-\[env\(safe-area-inset-top\)\]/);
  assert.match(platformShell, /hidden rounded-full[\s\S]*sm:inline-flex/);
  assert.match(platformNav, /min-h-11/);
  assert.match(platformNav, /100dvh/);
  assert.match(platformPeople, /w-\[min\(86vw,420px\)\]/);
  assert.match(platformPeople, /w-\[min\(86vw,320px\)\]/);
  assert.doesNotMatch(platformPeople, /min-w-\[300px\]/);
  assert.doesNotMatch(platformPeople, /min-w-\[280px\]/);
});

test("HP15 keeps confirmation dialogs inside the dynamic mobile viewport", () => {
  assert.match(confirm, /items-end/);
  assert.match(confirm, /100dvh/);
  assert.match(confirm, /safe-area-inset-bottom/);
  assert.match(confirm, /overflow-y-auto/);
  assert.match(confirm, /min-h-11/);
});

test("HP15 keeps known dense surfaces intentionally scrollable instead of overflowing the page", () => {
  assert.match(platformPilot, /overflow-x-auto/);
  assert.match(discovery, /overflow-x-auto/);
  assert.match(companyProfile, /overflow-x-auto/);
  assert.match(globals, /overflow-x: hidden/);
  assert.match(platformKnowledge, /w-full grid-cols-2/);
});

test("HP15 gives primary Marketplace mobile actions full-width phone targets", () => {
  assert.match(marketplaceNew, /h-11 w-full[\s\S]*sm:w-auto/);
  assert.match(marketplaceResponse, /w-full rounded-xl bg-\[#1a5144\][\s\S]*sm:w-auto/);
});
