import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const base = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, base), "utf8");
const component = read("components/home-floating-tools.tsx");
const styles = read("components/home-floating-tools.module.css");
const it = read("app/(italian)/page.tsx");
const en = read("app/(english)/en/page.tsx");

test("HOME-CALC-FLOAT1A adds bilingual floating tools without replacing cinematic hero", () => {
  assert.match(it, /<PublicCinematicHero locale="it" \/>/);
  assert.match(en, /<PublicCinematicHero locale="en" \/>/);
  assert.match(it, /<HomeFloatingTools locale="it" \/>/);
  assert.match(en, /<HomeFloatingTools locale="en" \/>/);
  assert.match(component, /Pesi e Norme/);
  assert.match(component, /Crea una richiesta/);
  assert.match(component, /Weights & Standards/);
  assert.match(component, /Create an RFQ/);
  assert.match(component, /\/knowledge\/tubes#calcolatore-pesi/);
  assert.match(component, /\/en\/distinta/);
});
test("Floating dock is bottom center, lazily loads the real tools and can close", () => {
  assert.match(styles, /position: fixed/);
  assert.match(styles, /left: 50%/);
  assert.match(styles, /translateX\(-50%\)/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /aria-modal=/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /setVisited/);
});
