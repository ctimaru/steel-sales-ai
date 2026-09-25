import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const product = fs.readFileSync(new URL("../app/(workspace)/products/[productId]/page.tsx", import.meta.url), "utf8");
const prices = fs.readFileSync(new URL("../app/(workspace)/products/[productId]/prices/page.tsx", import.meta.url), "utf8");
const upload = fs.readFileSync(new URL("../components/bulk-upload-form.tsx", import.meta.url), "utf8");

test("PA2.33 mobile keeps secondary sales tools reachable", () => {
  assert.match(shell, />Altro</);
  for (const href of ["/assistant", "/review", "/alerts", "/uploads", "/data-sources"]) {
    assert.match(shell, new RegExp(`href: "${href}"`));
  }
});

test("PA2.33 avoids unqualified verified-data claims", () => {
  assert.doesNotMatch(product, />Dati verificati</);
  assert.doesNotMatch(prices, />Dati verificati</);
  assert.match(product, />Dati commerciali</);
  assert.match(prices, />Dati commerciali</);
});

test("PA2.33 price history prefers exact original evidence", () => {
  assert.match(prices, /\/evidence\/\$\{row\.observation_id\}/);
  assert.match(prices, />Originale ↗</);
});

test("PA2.33 upload flow is sales-friendly after processing", () => {
  for (const label of ["In coda", "In elaborazione", "Completata", "Completata con errori", "Non riuscita"]) {
    assert.match(upload, new RegExp(label));
  }
  assert.match(upload, /Cerca i dati importati/);
  assert.match(upload, /Vedi dettaglio import/);
});
