import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const ui = source("../components/global-search.tsx");
const action = source("../app/(workspace)/search/actions.ts");
const page = source("../app/(workspace)/search/page.tsx");

test("COMM-UX1C.1 renders actual preview coverage rather than claiming full search", () => {
  assert.match(ui, /state\.quality\?\.preview_limited/);
  assert.match(ui, /Anteprima dei risultati/);
  assert.match(ui, /Alcuni elementi dell'archivio potrebbero non essere mostrati/);
  assert.match(ui, /backfill_incomplete/);
  assert.match(ui, /source_references/);
  assert.match(action, /quality\?: \{/);
  assert.match(action, /quality: payload\?\.quality \?\? null/);
  assert.doesNotMatch(ui, /Rilevanza \{Number/);
});

test("COMM-UX1C.1 never mistakes source locator for verified original content", () => {
  assert.match(ui, /Il riferimento non equivale a una verifica del contenuto/);
  assert.match(ui, /Riferimento alla fonte/);
  assert.match(ui, /Fonte diretta non disponibile/);
  assert.match(ui, /target\.startsWith\("\/evidence\/"\)/);
  assert.match(ui, /Apri originale/);
  assert.match(page, /non vengono associate automaticamente al CRM/);
});

test("COMM-UX1C.1 guides users with sparse normalized Company 360", () => {
  assert.match(ui, /scope === "companies"/);
  assert.match(ui, /Nessuna azienda normalizzata trovata/);
  assert.match(ui, /commercialSearchHref\(query, "documents"\)/);
  assert.match(ui, /non crea automaticamente un'azienda/);
});

test("COMM-UX1C.1 keeps authenticated worker and omits raw queries from telemetry", () => {
  assert.match(action, /supabase\.auth\.getClaims\(\)/);
  assert.match(action, /actor_user_id: actorUserId/);
  assert.match(action, /x-worker-token/);
  assert.match(action, /metadata: \{ surface: "global_search" \}/);
  assert.doesNotMatch(action, /metadata: \{[^}]*query/);
  assert.doesNotMatch(action, /SUPABASE_SERVICE_ROLE_KEY/);
});
