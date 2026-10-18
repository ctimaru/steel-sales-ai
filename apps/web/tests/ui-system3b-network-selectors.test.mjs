import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/network-role-discovery.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("UI-SYSTEM3B role and category selections use shared semantic actions", () => {
  assert.match(source, /actionClasses\(\{ variant: selected \? "default" : "secondary"/);
  assert.match(source, /actionClasses\(\{ variant: !currentRole \? "default" : "secondary"/);
  assert.match(source, /actionClasses\(\{ variant: currentRole===role \? "default" : "secondary"/);
  assert.match(source, /actionClasses\(\{ variant: "ghost"/);
});
test("UI-SYSTEM3B retains deep links, state and explicit accessible active colors", () => {
  assert.match(source, /aria-current=\{selected \? "page"/);
  assert.match(source, /aria-current=\{currentRole === role \? "page"/);
  assert.match(source, /networkDiscoveryHref\(filters,\{persona:role\}/);
  assert.match(source, /networkDiscoveryHref\(filters,\{role\}/);
  assert.match(css, /#network-role-discovery \.network-role-chip-active/);
  assert.match(css, /-webkit-text-fill-color: #ffffff !important/);
});
