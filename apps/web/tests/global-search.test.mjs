import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/search/actions.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/search/page.tsx", import.meta.url),
  "utf8",
);
const component = fs.readFileSync(new URL("../components/global-search.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("global search derives actor server-side and calls tenant-safe worker endpoint", () => {
  assert.match(actions, /supabase\.auth\.getClaims\(\)/);
  assert.match(actions, /actor_user_id: actorUserId/);
  assert.match(actions, /\/v1\/global-search/);
  assert.doesNotMatch(actions, /owner_id:/);
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("global search exposes P1.4 result families and steel filters", () => {
  for (const label of ["Documenti", "Prodotti", "Aziende", "RFQ", "Offerte"]) {
    assert.match(component, new RegExp(label));
  }
  for (const field of [
    "company",
    "grade",
    "standard",
    "outer_diameter_mm",
    "thickness_mm",
    "price_min",
    "price_max",
    "source",
    "date_from",
    "date_to",
  ]) {
    assert.match(component, new RegExp(`name=\\"${field}\\"`));
  }
});

test("global search route is first-class workspace navigation", () => {
  assert.match(page, /Global Search/);
  assert.match(page, /structured \+ semantic/);
  assert.match(shell, /href: "\/search"/);
  assert.match(shell, /label: "Global Search"/);
});
