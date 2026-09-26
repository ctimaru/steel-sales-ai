import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/products/actions.ts", import.meta.url), "utf8");
const detail = fs.readFileSync(new URL("../app/(workspace)/products/[productId]/page.tsx", import.meta.url), "utf8");
const prices = fs.readFileSync(new URL("../app/(workspace)/products/[productId]/prices/page.tsx", import.meta.url), "utf8");

test("P1.8 Price History keeps the verified server actor and worker boundary", () => {
  assert.match(actions, /loadPriceHistory/);
  assert.match(actions, /supabase\.auth\.getUser\(\)/);
  assert.match(actions, /actor_user_id: actor/);
  assert.match(actions, /\/v1\/products\/\$\{encodeURIComponent\(productId\)\}\/prices/);
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("P1.8 exposes quote vs order, normalized values, trend and evidence", () => {
  for (const label of ["Ultima offerta", "Ultimo ordine", "Storico prezzi verificabile", "Comparabili", "Incoterm / resa", "Peso teorico"]) {
    assert.match(prices, new RegExp(label));
  }
  assert.match(prices, /normalized_per_tonne/);
  assert.match(prices, /trendText/);
  assert.match(prices, /comparability_score/);
  assert.match(prices, /appRoutes\.commercial\.conversation\(row\.thread_id\)/);
  assert.match(prices, /Non disponibile/);
  assert.match(prices, /Valute diverse non vengono convertite/);
});

test("Product 360 links to the dedicated Price History surface", () => {
  assert.match(detail, /appRoutes\.commercial\.productPrices\(productId\)/);
  assert.match(detail, /Apri storico prezzi/);
});
