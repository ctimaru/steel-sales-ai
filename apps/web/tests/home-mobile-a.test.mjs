import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const header = read("../components/public-home-header.tsx");
const nav = read("../components/public-home-navigation.tsx");
const menu = read("../components/public-home-menu.tsx");
const hero = read("../components/public-cinematic-hero.tsx");
const heroCss = read("../components/public-cinematic-hero.module.css");
const card = read("../components/public-network-pro.tsx");
const consent = read("../components/google-analytics-consent.tsx");
const home = read("../app/(italian)/page.tsx");
const polish = read("../components/home-mobile-polish.module.css");

test("HOME-MOBILE-A1: one header row on phones, sections and languages in the ☰ menu", () => {
  assert.doesNotMatch(nav, /"Navigazione mobile" :|grid-cols-\[repeat\(3/);
  assert.match(header, /<PublicHomeMenu /);
  assert.match(header, /<div className="hidden sm:block">\s*<PublicPageLanguageSelector/);
  for (const href of ['"/"', '"/en"', '"/de"', '"/fr"', '"/es"']) assert.ok(menu.includes(`href: ${href}`), href);
  assert.match(menu, /"Escape"/);
  assert.match(menu, /onClick=\{closeMenu\}/);
  assert.doesNotMatch(menu, /international-calculator-landing/); // keep the client island tiny
});

test("HOME-MOBILE-A2: register CTA reaches the first phone screen", () => {
  const block = heroCss.slice(heroCss.indexOf("HOME-MOBILE-A2"));
  assert.match(block, /\.copy \{ display: contents; \}/);
  assert.match(block, /\.actions \{ order: 3;[^}]*flex-wrap: nowrap/);
  assert.match(block, /\[data-testid="public-network-pro-showcase"\] \{ order: 4;/);
  assert.match(block, /\.caveat \{ order: 5;/);
  assert.match(block, /\.visualCaption \{ display: none; \}/);
  assert.match(hero, /styles\.labelShort/);
  assert.match(card, /<div className="relative flex flex-col">/);
  assert.match(card, /max-\[700px\]:order-1/); // benefits after the CTA on phones
  assert.match(card, /max-\[700px\]:order-2/);
  assert.match(card, /data-testid="public-network-pro-register"/);
});

test("HOME-MOBILE-A3: phone cookie banner is compact but keeps notice, links and equal choices", () => {
  assert.match(consent, /consent === null \? " max-sm:hidden" : ""/);
  assert.match(consent, /Usiamo cookie necessari\. Google Analytics invia segnali senza cookie/);
  assert.equal((consent.match(/href="\/privacy"/g) || []).length, 2);
  assert.equal((consent.match(/href="\/cookies"/g) || []).length, 2);
  assert.ok((consent.match(/min-h-11 rounded-xl border/g) || []).length >= 2);
});

test("HOME-MOBILE-A4: readable labels and 44px footer links on phones", () => {
  assert.match(home, /mobilePolish\.home/);
  assert.match(polish, /\.text-\\\[10px\\\]/);
  assert.match(polish, /font-size: 11px/);
  assert.match(home, /const footerLink = "inline-flex min-h-11 items-center/);
  assert.match(home, /grid grid-cols-2 gap-x-4 sm:flex/);
  assert.match(heroCss.slice(heroCss.indexOf("HOME-MOBILE-A2")), /\.quickLinks a \{[^}]*min-height: 44px/);
});
