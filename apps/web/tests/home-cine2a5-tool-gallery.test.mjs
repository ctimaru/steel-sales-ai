import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const cards = fs.readFileSync(new URL("../components/home-cinematic-tools.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../components/home-cinematic-tools.module.css", import.meta.url), "utf8");
const it = fs.readFileSync(new URL("../app/(italian)/page.tsx", import.meta.url), "utf8");
const en = fs.readFileSync(new URL("../app/(english)/en/page.tsx", import.meta.url), "utf8");

test("CINE2A.5 exposes five tools in both languages with safe public and registration routes", () => {
  for (const title of ["Norme e pesi", "Distinta", "Network", "Commerciale", "Scuola", "Standards & weights", "RFQ builder", "Commercial workspace", "Knowledge"]) assert.ok(cards.includes(title), title);
  assert.match(cards, /href: "\/register"/);
  assert.match(cards, /href: "\/en\/register"/);
  assert.match(cards, /id="home-tools"/);
  assert.match(it, /<HomeCinematicTools locale="it" \/>/);
  assert.match(en, /<HomeCinematicTools locale="en" \/>/);
});
test("CINE2A.5 retains keyboard accessibility and responsive/reduced motion behavior", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /max-width:560px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(cards, /"use client"|fetch\s*\(|localStorage|createClient/);
});
