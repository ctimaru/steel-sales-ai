import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const heroCss = read("../components/public-cinematic-hero.module.css");
const home = read("../app/(italian)/page.tsx");
const proof = read("../components/public-steel-geometry-proof.tsx");
const cont = read("../components/public-cinematic-continuity.module.css");
const tools = read("../components/home-cinematic-tools.tsx");
const toolsCss = read("../components/home-cinematic-tools.module.css");
const roles = read("../components/public-network-role-explorer.tsx");
const pillars = read("../components/public-intelligence-showcase.tsx");

test("HOME-MOBILE-B5: no 'Un unico percorso' strip on phones", () => {
  assert.match(heroCss.slice(heroCss.indexOf("HOME-MOBILE-B5")), /\.bridge \{ display: none; \}/);
});

test("HOME-MOBILE-B6: one public tools section (geometry + four tiles), no separate shelf", () => {
  assert.doesNotMatch(home, /cineStyles\.toolSection|Prima utilità, poi prodotto/);
  assert.match(home, /<PublicSteelGeometryProof locale="it" tools=\{publicTools\} \/>/);
  for (const href of ["/distinta", "/knowledge/norme", "/knowledge/gradi", "source=home&surface=school_section#calcolatore-pesi"]) assert.ok(home.includes(href), href);
  assert.match(proof, /data-testid="home-public-tools"/);
  assert.match(proof, /styles\.proofActions/); // English keeps the two actions
  assert.match(cont, /\.quickTool \{[^}]*min-height: 64px/);
  assert.match(cont.slice(cont.indexOf("HOME-MOBILE-B6")), /\.process \{ display: none; \}/);
});

test("HOME-MOBILE-B7: five tools swipe horizontally on phones, still five links", () => {
  assert.equal((tools.match(/<Link key=\{tool\.number\}/g) || []).length, 1);
  assert.doesNotMatch(tools, /role="listitem"/);
  const block = toolsCss.slice(toolsCss.indexOf("HOME-MOBILE-B7"));
  assert.match(block, /\.inner\{padding-inline:18px\}/); // bleed equals padding: no page overflow
  assert.match(block, /margin-inline:-18px/);
  assert.match(block, /overflow-x:auto/);
  assert.match(block, /scroll-snap-type:x mandatory/);
  assert.match(block, /scroll-snap-align:start/);
  assert.match(tools, /Scorri per vederli tutti/);
});

test("HOME-MOBILE-B8: role explorer shows the benefit first, details on demand (CSS-only)", () => {
  assert.match(roles, /type="checkbox" id=\{`network-persona-more-\$\{key\}`\}/);
  assert.equal((roles.match(/cineStyles\.personaMore[} ]/g) || []).length, 3);
  assert.match(roles, /Scopri di più: chi trovi e cosa cerchi/);
  assert.doesNotMatch(roles, /"use client"/);
  const block = cont.slice(cont.indexOf("HOME-MOBILE-B8"));
  assert.match(block, /\.networkPanel:has\(\.personaMoreToggle:checked\) \.personaMore \{ display: block; \}/);
  assert.match(block, /@media \(min-width: 701px\) \{\s*\.personaMoreToggle \{ display: none; \}/);
});

test("HOME-MOBILE-B9: intelligence pillars compact on phones", () => {
  assert.equal((pillars.match(/text-\[#52615b\] max-\[700px\]:hidden/g) || []).length, 3);
  assert.equal((pillars.match(/border p-5 max-\[700px\]:p-4/g) || []).length, 3);
});
