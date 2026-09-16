import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/products/actions.ts", import.meta.url), "utf8");
const catalog = fs.readFileSync(new URL("../app/(workspace)/products/page.tsx", import.meta.url), "utf8");
const detail = fs.readFileSync(new URL("../app/(workspace)/products/[productId]/page.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("Product 360 derives actor from verified server session and uses worker boundary", () => {
  assert.match(actions, /supabase\.auth\.getUser\(\)/);
  assert.match(actions, /actor_user_id: actor/);
  assert.match(actions, /\/v1\/products/);
  assert.doesNotMatch(actions, /owner_id:/);
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("Product catalog exposes canonical lifecycle counts and latest price", () => {
  assert.match(catalog, /Product 360/);
  for (const label of ["RFQ", "Offerte", "Ordini", "Consegne", "ultimo prezzo offerto"]) {
    assert.match(catalog, new RegExp(label));
  }
  assert.match(catalog, /canonical_product_id/);
});

test("Product detail exposes killer use case and verifiable source history", () => {
  for (const label of ["Ultimo prezzo", "Storico prezzi", "Timeline commerciale", "Documenti sorgente", "Clienti \/ fornitori collegati"]) {
    assert.match(detail, new RegExp(label));
  }
  assert.match(detail, /\/conversations\/\$\{row\.thread_id\}/);
  assert.match(detail, /nessuna inferenza dal testo/i);
});

test("Product 360 is first-class workspace navigation", () => {
  assert.match(shell, /href: "\/products"/);
  assert.match(shell, /label: "Product 360"/);
});
