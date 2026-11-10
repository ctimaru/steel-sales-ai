import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const streams = read("lib/commercial-unified-streams.ts");
const worklist = read("components/commercial-unified-worklist.tsx");
const page = read("app/(italian)/(workspace)/commercial/page.tsx");

test("COMM-FOCUS1: tre filtri d'azione con conteggi esatti dal server", () => {
  assert.match(streams, /reply: "Da rispondere", waiting: "In attesa", due: "In scadenza"/);
  assert.match(streams, /export async function loadCommercialFocusCounts/);
  assert.match(streams, /\{ count: "exact", head: true \}/);
  // Solo conteggi, nessuna riga letta: niente testo email né prezzi.
  const counts = streams.slice(streams.indexOf("export async function loadCommercialFocusCounts"));
  assert.doesNotMatch(counts, /raw_spec_text|source_text|price|total_eur|notes/);
  assert.match(counts, /if \(results\.some\(\(r\) => r\.error \|\| r\.count === null\)\) return null;/);
});

test("COMM-FOCUS1: il filtro è nel cursore e vale solo nella vista Tutte", () => {
  assert.match(streams, /\(candidate\.focus \?\? ""\) !== focus/);
  assert.match(streams, /const focus = view === "all" \? requestedFocus : "";/);
  assert.match(streams, /if \(focus && view === "all"\) params\.set\("focus", focus\);/);
  assert.match(page, /const focus = view === "all" \? parseCommercialFocus\(params\.focus\) : "";/);
});

test("COMM-FOCUS1: i contatori sono link di filtro accessibili e il filtro resta nei link", () => {
  assert.match(worklist, /data-testid="commercial-focus-active"/); // COMM-CLEAN-LIST1: i contatori sono nelle schede in alto
  assert.doesNotMatch(worklist, /data-testid="commercial-focus-counters"/);
  assert.match(worklist, /<input type="hidden" name="focus" value=\{focus\} \/>/);
  assert.match(worklist, /route\(view, query, item\.key, data\.paging\?\.page \?\? page, data\.paging\?\.currentCursor, focus\)/);
  assert.match(worklist, /emptyCause = data\.partial \? "unavailable" : query \|\| focus \? "filtered"/);
});
