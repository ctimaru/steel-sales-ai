import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const button = readFileSync(new URL("../components/ui/button.tsx", import.meta.url), "utf8");

test("UI-SYSTEM1: all action variants use semantic classes", () => {
  for (const variant of ["primary", "secondary", "soft", "ghost", "danger"]) {
    assert.match(css, new RegExp(`\\.ui-action-${variant}\\s*\\{`));
    assert.match(button, new RegExp(`ui-action-${variant}`));
  }
  assert.match(button, /export function ActionLink/);
});
test("UI-SYSTEM1: solid variants enforce visible white text, including Safari", () => {
  for (const variant of ["primary", "danger"]) {
    const match = css.match(new RegExp(`\\.ui-action-${variant}\\s*\\{([^}]+)\\}`));
    assert.ok(match, `missing ${variant}`);
    assert.match(match[1], /color:\s*#ffffff\s*!important/);
    assert.match(match[1], /-webkit-text-fill-color:\s*#ffffff\s*!important/);
  }
});
test("UI-SYSTEM1: light variants retain dark foreground", () => {
  for (const variant of ["secondary", "soft"]) {
    const match = css.match(new RegExp(`\\.ui-action-${variant}\\s*\\{([^}]+)\\}`));
    assert.ok(match);
    assert.match(match[1], /color:\s*var\(--brand-deep\)\s*!important/);
  }
});
