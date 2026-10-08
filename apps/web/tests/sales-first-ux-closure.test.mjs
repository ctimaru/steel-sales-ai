import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const navigation = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const bell = fs.readFileSync(new URL("../components/workspace-notification-bell.tsx", import.meta.url), "utf8");
const product = fs.readFileSync(new URL("../app/(workspace)/products/[productId]/page.tsx", import.meta.url), "utf8");
const prices = fs.readFileSync(new URL("../app/(workspace)/products/[productId]/prices/page.tsx", import.meta.url), "utf8");
const upload = fs.readFileSync(new URL("../components/bulk-upload-form.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const dataSources = fs.readFileSync(new URL("../app/(workspace)/data-sources/page.tsx", import.meta.url), "utf8");

test("PA2.33 mobile keeps secondary sales tools reachable without duplicating operations in the avatar drawer", () => {
  assert.match(shell, /WorkspaceMobileBottomNavigation/);
  assert.match(shell, /WorkspaceProfileMenu/);
  assert.match(shell, /appRoutes\.commercial\.assistant/);
  assert.match(bell, /appRoutes\.operations\.alerts/);
  assert.match(navigation, /appRoutes\.company\.dataSources/);
  assert.match(dashboard, /appRoutes\.operations\.review/);
  assert.match(dashboard + dataSources, /appRoutes\.operations\.uploads/);
  assert.doesNotMatch(navigation, /label="Revisioni dati"/);
  assert.doesNotMatch(navigation, /label="Importa documenti"/);
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
