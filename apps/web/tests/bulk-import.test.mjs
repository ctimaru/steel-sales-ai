import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/uploads/bulk-actions.ts", import.meta.url), "utf8");
const component = fs.readFileSync(new URL("../components/bulk-upload-form.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/uploads/page.tsx", import.meta.url), "utf8");

test("bulk file bytes upload directly to private Supabase Storage", () => {
  assert.match(component, /uploadToSignedUrl/);
  assert.match(component, /commercial-uploads/);
  assert.doesNotMatch(actions, /FormData\(/);
  assert.match(actions, /\/v1\/import-batches\/prepare/);
});

test("bulk UI exposes progress, deduplication and selective retry", () => {
  assert.match(component, /completed_items/);
  assert.match(component, /deduplicated_items/);
  assert.match(component, /retryBulkImport/);
  assert.match(component, /Riprova tutti gli errori/);
  assert.match(component, /crypto\.subtle\.digest/);
});

test("bulk server actions always derive actor from verified Supabase claims", () => {
  assert.match(actions, /supabase\.auth\.getClaims\(\)/);
  assert.match(actions, /actor_user_id: actorUserId/);
  assert.match(actions, /WORKER_INTERNAL_TOKEN/);
});


test("import UI uses sales-facing language while preserving bulk mechanics", () => {
  for (const forbidden of ["Ingestion", "Import multiplo", "batch completato", "Retry selettivo", "deduplicati"]) {
    assert.doesNotMatch(page + component, new RegExp(forbidden));
  }
  assert.match(page, /Aggiungi documenti allo storico/);
  assert.match(page, /Vedi import precedenti/);
  assert.match(component, /Avvia importazione/);
  assert.match(component, /già presenti nello storico/);
  assert.match(component, /Nuovo tentativo/);
  assert.match(component, /crypto\.subtle\.digest/);
  assert.match(component, /deduplicated_items/);
});
