import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const nav = read("../components/public-home-navigation.tsx");
const header = read("../components/public-home-header.tsx");
const it = read("../app/page.tsx");
const en = read("../app/en/page.tsx");

test("HOME-NAV1 uses the same public header component for both languages", () => {
  assert.match(it, /<PublicHomeHeader locale="it"/);
  assert.match(header, /<PublicHomeNavigation locale=\{locale\}/);
  assert.match(en, /<PublicHomeHeader locale="en"/);
  assert.match(nav, /xl:flex/);
  assert.match(nav, /xl:hidden/);
});

test("HOME-NAV1 prevents mobile horizontal scrolling and retains accessible overflow links", () => {
  assert.match(nav, /grid-cols-\[repeat\(3,minmax\(0,1fr\)\)_auto\]/);
  assert.match(nav, /<details className="group relative">/);
  assert.match(nav, /<summary/);
  assert.match(nav, /aria-label=/);
  assert.doesNotMatch(nav, /overflow-x-auto/);
});

test("HOME-NAV1 retains public tools and private entry routes", () => {
  for (const href of ["/distinta", "/knowledge", "/azienda", "/en/distinta", "/en/knowledge"]) {
    assert.ok(nav.includes(href), href);
  }
  assert.match(header, /"\/login"/);
  assert.match(header, /"\/register"/);
  assert.match(header, /"\/en\/login"/);
  assert.match(header, /"\/en\/register"/);
});
