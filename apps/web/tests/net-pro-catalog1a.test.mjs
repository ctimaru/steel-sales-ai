import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const catalog = read("lib/network-pro-catalog.ts");
const ux = read("components/network-pro-catalog.tsx");
const route = read("app/(italian)/(workspace)/network/pro/page.tsx");
const network = read("components/network-compact-experience.tsx");
const gate = read("components/network-access-gate.tsx");
const routes = read("lib/routes.ts");

test("NET-PRO-CATALOG1.A keeps four compatible industry modules and no separate datasets", () => {
  for (const [key, role] of [
    ["producers", "producer"],
    ["distributors", "trader_distributor"],
    ["end_users", "end_user"],
    ["processors", "processor_service_provider"],
  ]) {
    assert.match(catalog, new RegExp('key: "' + key + '"'));
    assert.match(catalog, new RegExp('role: "' + role + '"'));
  }
  assert.match(catalog, /export type NetworkProModuleKey/);
  assert.doesNotMatch(catalog, /supabase|fetch\s*\(/i);
});

test("NET-PRO-CATALOG1.A commercial proposal distinguishes Italy and Europe and bundles", () => {
  assert.match(catalog, /IT: \{ 0: 0, 1: 39, 2: 66, 3: 94, 4: 119 \}/);
  assert.match(catalog, /EU: \{ 0: 0, 1: 69, 2: 117, 3: 166, 4: 199 \}/);
  assert.match(catalog, /new Set\(selected\.filter/);
  assert.match(catalog, /purchasable: false as const/);
  assert.match(ux, /Prezzi proposti, ancora da validare/);
  assert.match(ux, /Nessun ordine o pagamento viene creato/);
});

test("NET-PRO-CATALOG1.A offers accessible responsive selection without fake checkout", () => {
  assert.match(ux, /"use client"/);
  assert.match(ux, /aria-pressed=\{active\}/);
  assert.match(ux, /aria-label="Copertura geografica"/);
  assert.match(ux, /aria-label="Periodicità abbonamento"/);
  assert.match(ux, /aria-live="polite"/);
  assert.match(ux, /sm:grid-cols-2/);
  assert.match(ux, /lg:sticky lg:top-24/);
  assert.match(ux, /Checkout non ancora disponibile: configurazione Stripe/);
  assert.match(ux, /disabled=\{!billingReady\|\|!canCheckout\|\|!coverage\|\|hasPaidSubscription/);
  assert.match(ux, /data-testid="netpro-f1-checkout"/);
  assert.doesNotMatch(ux, /stripe\.com\/|paymentIntent|grantEntitlement|<form[^>]*action=/i);
});

test("NET-PRO-CATALOG1.A remains inside authenticated Network, visible to Free and Pro", () => {
  assert.match(route, /isNetworkFrontendEnabled/);
  assert.match(route, /NetworkProCatalog/);
  assert.match(routes, /pro: "\/network\/pro"/);
  assert.match(network, /href="\/network\/pro"/);
  assert.match(gate, /appRoutes\.network\.pro/);
  assert.match(gate, /non introduce un checkout fittizio/);
  assert.doesNotMatch(route, /getNetworkAccessState|requireNetworkAccess/);
});
