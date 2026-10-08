import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const sharedHook = source("../lib/use-notification-popover-dismiss.ts");
const workspaceBell = source("../components/workspace-notification-bell.tsx");
const platformBell = source("../components/platform-notification-bell.tsx");
const oldMenuController = source("../components/header-menu-dismiss-controller.tsx");

for (const [name, code] of [
  ["Workspace", workspaceBell],
  ["Platform", platformBell],
]) {
  test(`UXN1 ${name}: outside-click behavior uses shared document listener`, () => {
    assert.match(code, /useNotificationPopoverDismiss\(\{ open, triggerRef, panelRef, onDismiss: dismiss \}\)/);
    assert.match(code, /const dismiss = useCallback\(\(\) => setOpen\(false\), \[\]\)/);
    assert.match(code, /ref=\{triggerRef\}/);
    assert.match(code, /ref=\{panelRef\}/);
    assert.match(code, /onClick=\{\(\) => setOpen\(false\)\}/);
    assert.match(code, /useEffect\(\(\) => \{ setOpen\(false\); \}, \[pathname\]\)/);
    assert.match(code, /aria-expanded=\{open\}/);
    assert.match(code, /role="dialog" aria-modal="false"/);
    assert.doesNotMatch(code, /className="fixed inset-0 z-50/);
    assert.doesNotMatch(code, /bg-black\/15/);
    assert.doesNotMatch(code, /handlePanelKeyDown|onKeyDown=\{handlePanelKeyDown\}/);
  });
}

test("UXN1 pointerdown dismissal works for touch, mouse and pen without blocking the user's click", () => {
  assert.match(sharedHook, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/);
  assert.match(sharedHook, /document\.removeEventListener\("pointerdown", handlePointerDown, true\)/);
  assert.match(sharedHook, /if \(!open\) return/);
  assert.match(sharedHook, /triggerRef\.current\?\.contains\(target\)/);
  assert.match(sharedHook, /panelRef\.current\?\.contains\(target\)/);
  assert.match(sharedHook, /onDismiss\(\)/);
  const outsideHandler = sharedHook.split("function handlePointerDown")[1]?.split("function handleKeyDown")[0] ?? "";
  assert.doesNotMatch(outsideHandler, /preventDefault|stopPropagation/);
  assert.doesNotMatch(sharedHook, /stopPropagation/);
  assert.doesNotMatch(sharedHook, /setTimeout/);
});

test("UXN1 Escape dismisses and restores focus to the bell, with listener teardown", () => {
  assert.match(sharedHook, /event\.key !== "Escape"/);
  assert.match(sharedHook, /triggerRef\.current\?\.focus\(\)/);
  assert.match(sharedHook, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(sharedHook, /document\.removeEventListener\("keydown", handleKeyDown\)/);
  assert.match(sharedHook, /\[open, triggerRef, panelRef, onDismiss\]/);
});

test("UXN1 does not regress the separate native header-details menus", () => {
  assert.match(oldMenuController, /header details\[open\]/);
  assert.match(oldMenuController, /pointerdown/);
  assert.match(oldMenuController, /closeHeaderMenus\(\)/);
  assert.match(workspaceBell, /appRoutes\.notifications/);
  assert.match(platformBell, /appRoutes\.platform\.notifications/);
});
