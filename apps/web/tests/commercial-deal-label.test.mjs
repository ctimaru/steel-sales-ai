import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/20261110110000_commercial_deal_label.sql", import.meta.url), "utf8");
const action = read("app/(italian)/(workspace)/commercial/deal-label-actions.ts");
const streams = read("lib/commercial-unified-streams.ts");
const worklist = read("components/commercial-unified-worklist.tsx");
const labels = read("lib/commercial-deal-labels.ts");
const text = read("lib/commercial-deal-label-text.ts");

test("COMM-LABEL1: migrazione additiva, facoltativa e limitata a 80 caratteri", () => {
  for (const table of ["rfqs", "offers", "orders"]) {
    assert.match(migration, new RegExp("alter table public\\." + table + " add column if not exists deal_label text;"));
  }
  assert.match(migration, /char_length\(btrim\(deal_label\)\) between 1 and 80/);
  assert.doesNotMatch(migration, /drop |delete |update public|create policy|alter policy/i);
});

test("COMM-LABEL1: l'azione richiede scrittura, aggiorna solo il nome sotto RLS e tenant", () => {
  assert.match(action, /^"use server";/);
  assert.doesNotMatch(action.replace(/^"use server";/, ""), /export (const|function|let)\b/);
  assert.match(action, /canWriteWorkspace\(context\.role\)/);
  assert.match(action, /\.update\(\{ deal_label: label \}\)/);
  assert.match(action, /\.eq\("organization_id", context\.organizationId\)/);
  assert.match(action, /UUID\.test\(id\)/);
});

test("COMM-LABEL1: la normalizzazione toglie a capo e limita la lunghezza", () => {
  assert.match(text, /DEAL_LABEL_MAX = 80/);
  assert.match(text, /\\u0000-\\u001f/);
  assert.match(text, /\.slice\(0, DEAL_LABEL_MAX\)/);
});

test("COMM-LABEL1: il nome sostituisce il titolo e si cerca come lo stato", () => {
  assert.match(streams, /const headline = dealLabel \? dealLabel :/);
  assert.equal((streams.match(/status\.ilike\.%" \+ q \+ "%,deal_label\.ilike\.%/g) ?? []).length, 3);
  assert.match(worklist, /canWrite && inboundKind \?/);
  assert.match(worklist, /<CommercialDealLabelForm kind=\{inboundKind\}/);
  assert.match(labels, /select\("id,deal_label"\)/);
  assert.doesNotMatch(labels, /raw_spec_text|source_text|price|notes/);
});
