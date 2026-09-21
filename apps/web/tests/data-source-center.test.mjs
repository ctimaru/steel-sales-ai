import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/data-sources/actions.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/data-sources/page.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("data source center derives actor identity server-side and calls trusted worker", () => {
  assert.match(actions, /supabase\.auth\.getClaims\(\)/);
  assert.match(actions, /actor_user_id: actorUserId/);
  assert.match(actions, /\/v1\/data-sources\/history/);
  assert.match(actions, /WORKER_INTERNAL_TOKEN/);
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("data source center exposes required P1.3 operational states", () => {
  assert.match(page, /Indicizzati/);
  assert.match(page, /Duplicati/);
  assert.match(page, /Errori \/ scartati/);
  assert.match(page, /Ultimo aggiornamento/);
  assert.match(page, /Storico importazioni/);
  assert.match(page, /File ed email importati/);
});

test("workspace navigation links source history and import workflow", () => {
  assert.match(shell, /href: "\/data-sources"/);
  assert.match(shell, /href: "\/uploads"/);
  assert.match(page, /href="\/uploads"/);
});


test("data source center uses operational sales-facing language", () => {
  for (const forbidden of ["Data source center", "P1.2", "chunk", "Nessun retry", "SHA-256 già presenti", "Ultimo sync"]) {
    assert.doesNotMatch(page, new RegExp(forbidden));
  }
  assert.match(page, /Fonti e import/);
  assert.match(page, /Documenti importati/);
  assert.match(page, /Storico importazioni/);
  assert.match(page, /parti disponibili alla ricerca/);
  assert.match(page, /Nessun nuovo tentativo/);
  assert.match(page, /Contenuti già presenti/);
});
