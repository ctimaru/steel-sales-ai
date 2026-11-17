import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const nav = read("../components/public-home-navigation.tsx");
const header = read("../components/public-home-header.tsx");
const menu = read("../components/public-home-menu.tsx");
const it = read("../app/page.tsx");
const en = read("../app/en/page.tsx");

test("HOME-NAV1 uses the same public header component for both languages", () => {
  assert.match(it, /<PublicHomeHeader locale="it"/);
  assert.match(header, /<PublicHomeNavigation locale=\{locale\}/);
  assert.match(en, /<PublicHomeHeader locale="en"/);
  assert.match(nav, /xl:flex/);
  // HOME-MOBILE-A1: below xl the section links live in the header ☰ menu.
  assert.match(header, /<PublicHomeMenu locale=\{locale\} links=\{publicHomeLinks\(locale\)\} \/>/);
  assert.match(menu, /xl:hidden/);
});

test("HOME-NAV1 prevents mobile horizontal scrolling and retains accessible overflow links", () => {
  assert.match(menu, /<details ref=\{ref\} className="group relative xl:hidden"/);
  assert.match(menu, /<summary/);
  assert.match(menu, /aria-label=\{it \? "Apri il menu" : "Open menu"\}/);
  assert.match(menu, /min-h-11/);
  assert.doesNotMatch(menu, /overflow-x-auto/);
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
