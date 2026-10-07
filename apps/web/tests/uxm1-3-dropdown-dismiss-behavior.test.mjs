import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const controller = fs.readFileSync(
  new URL("../components/header-menu-dismiss-controller.tsx", import.meta.url),
  "utf8",
);
const workspaceShell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const platformShell = fs.readFileSync(
  new URL("../components/platform-shell.tsx", import.meta.url),
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

test("UXM1.3 mounts one shared dismiss controller in both authenticated shells", () => {
  assert.match(workspaceShell, /HeaderMenuDismissController/);
  assert.match(platformShell, /HeaderMenuDismissController/);
});

test("UXM1.3 closes open header dropdowns when clicking outside", () => {
  assert.match(controller, /header details\[open\]/);
  assert.match(controller, /pointerdown/);
  assert.match(controller, /!menu\.contains\(target\)/);
  assert.match(controller, /menu\.open = false/);
});

test("UXM1.3 closes a dropdown immediately when one of its links is selected", () => {
  assert.match(controller, /header details a\[href\]/);
  assert.match(controller, /closest\("details"\)/);
  assert.match(controller, /menu\.open = false/);
});

test("UXM1.3 closes dropdowns on route changes and Escape", () => {
  assert.match(controller, /usePathname/);
  assert.match(controller, /\[pathname\]/);
  assert.match(controller, /event\.key === "Escape"/);
  assert.match(controller, /closeHeaderMenus\(\)/);
});

test("UXM1.3 covers the existing Intelligence and Platform mobile dropdowns", () => {
  assert.match(workspaceNav, /<details className="relative shrink-0">/);
  assert.match(workspaceNav, />\s*Intelligence\s*/);
  assert.match(platformNav, /<details className="relative lg:hidden">/);
  assert.match(platformNav, />\s*Menu\s*/);
});

test("UXM1.3 limits outside-click dismissal to header dropdowns", () => {
  assert.equal(
    controller.includes('const OPEN_HEADER_MENU_SELECTOR = "header details[open]"'),
    true,
  );
});
