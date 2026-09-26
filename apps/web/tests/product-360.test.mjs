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

test("Product 360 fails closed into a structured demo state before creating Supabase client", () => {
  assert.match(actions, /function supabaseConfigured\(\)/);
  assert.match(actions, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(actions, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(actions, /if \(!supabaseConfigured\(\)\) return null/);
  assert.match(actions, /non è disponibile in modalità demo/);
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
  assert.match(detail, /\/evidence\/\$\{row\.observation_id\}/);
  assert.match(detail, /\/evidence\/\$\{event\.observation_id\}/);
  assert.match(detail, /Originale ↗/);
  assert.match(detail, /appRoutes\.commercial\.conversation\(event\.thread_id\)/);
  assert.match(detail, /nessuna deduzione automatica dal testo/i);
});

test("product history is first-class sales navigation", () => {
  assert.match(shell, /href: appRoutes\.commercial\.products/);
  assert.match(shell, /label: "Storico prodotti"/);
});


test("Product 360 uses sales-facing terminology instead of internal identity language", () => {
  for (const forbidden of [
    "prodotto canonico",
    "prodotti canonici",
    "Tenant verified",
    "Reference match",
    "Shared Steel Knowledge",
    "Peso canonical",
    "Price History",
    "Product catalog",
  ]) {
    assert.doesNotMatch(catalog + detail, new RegExp(forbidden));
  }
  assert.match(detail, /Dati commerciali/);
  assert.match(detail, /Riferimento tecnico/);
  assert.match(detail, /Peso di riferimento/);
  assert.match(detail, /Apri storico prezzi/);
  assert.match(detail, /Conversazioni/);
});
