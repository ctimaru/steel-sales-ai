import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const hero = fs.readFileSync(new URL("../components/public-cinematic-hero.module.css", import.meta.url), "utf8");
const gallery = fs.readFileSync(new URL("../components/home-cinematic-tools.module.css", import.meta.url), "utf8");
const component = fs.readFileSync(new URL("../components/public-cinematic-hero.tsx", import.meta.url), "utf8");
test("HOME-CINE2A.6 uses one-column hero and full-width buttons on mobile", () => {
  assert.match(hero, /HOME-CINE2A\.6/);
  assert.match(hero, /max-width: 700px/);
  assert.match(hero, /\.primary, \.secondary \{ flex: 1 1 100%/);
  assert.match(hero, /max-width: 359px/);
  assert.match(component, /Norme e pesi/);
});
test("HOME-CINE2A.6 five tool cards remain readable on mobile and accessible", () => {
  assert.match(gallery, /max-width: 560px/);
  assert.match(gallery, /grid-template-columns: 46px minmax\(0,1fr\)/);
  assert.match(gallery, /max-width: 359px/);
  assert.match(gallery, /:focus-visible/);
  assert.match(gallery, /prefers-reduced-motion:reduce/);
});
