import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const menu = nav.slice(nav.indexOf("export function WorkspaceProfileMenu"));

test("profile menu closes on outside pointer, Escape, navigation, and trigger toggle", () => {
  assert.match(menu, /document\.addEventListener\("pointerdown", onPointerDown, true\)/);
  assert.match(menu, /panelRef\.current\?\.contains\(target\)/);
  assert.match(menu, /triggerRef\.current\?\.contains\(target\)/);
  assert.match(menu, /event\.key !== "Escape"/);
  assert.match(menu, /setOpen\(\(value\) => !value\)/);
  assert.match(menu, /\[pathname, closeMenu\]/);
});

test("profile menu is nonmodal, does not block page scrolling, and uses semantic palette", () => {
  assert.match(menu, /aria-modal="false"/);
  assert.doesNotMatch(menu, /bg-black\/25|bg-black\/10|document\.body\.style\.overflow/);
  assert.match(menu, /var\(--brand-deep\)/);
  assert.match(menu, /var\(--surface-muted\)/);
  assert.match(menu, /var\(--text-secondary\)/);
});
