import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const worklist = read("../components/commercial-unified-worklist.tsx");
const data = read("../lib/commercial-data.ts");
const loading = read("../app/(italian)/(workspace)/commercial/loading.tsx");

test("COMM-TRUST1.C dashboard must never display failed history metrics as real zero", () => {
  assert.match(data, /if \(metricError \|\| !metricRows\?\.length\)/,
    "Existing dashboard contract can return awaiting_assignment when metrics RPC fails");
  assert.match(page, /const historicalCount = \(count: number\) => mode === "awaiting_assignment" \? "—" : count/);
  assert.match(page, /historicalCount\(operational\.rfqs\)/);
  assert.match(page, /historicalCount\(operational\.offers\)/);
  assert.match(page, /historicalCount\(operational\.orders\)/);
  assert.doesNotMatch(page, /Dati in attesa di associazione/);
  assert.match(page, /Non possiamo confermare lo stato dello storico/);
});

test("COMM-TRUST1.C distinguishes unavailable, filtered, empty workspace and empty view", () => {
  assert.match(worklist, /const emptyCause = data\.partial \? "unavailable" : query \? "filtered" : view === "all" \? "workspace" : "view"/);
  assert.match(worklist, /Nessun risultato per questo filtro/);
  assert.match(worklist, /Impossibile verificare tutte le attività/);
  assert.match(worklist, /Nessuna richiesta cliente in questa vista/);
  assert.match(worklist, /Nessuna distinta salvata in questa vista/);
  assert.match(worklist, /Rimuovi filtro/);
  assert.match(worklist, /data-commercial-empty-state=\{emptyCause\}/);
  assert.doesNotMatch(worklist, /Nessuna attività in questa vista/);
});

test("COMM-TRUST1.C does not show pointless page 1 or force draft creation on read-only views", () => {
  assert.match(worklist, /data\.paging && \(data\.paging\.page > 1 \|\| data\.paging\.hasNext\)/);
  assert.match(worklist, /view === "drafts" \|\| view === "all"\) && canWrite/);
  assert.match(worklist, /Mostra tutte le trattative/);
  assert.match(worklist, /Controlla lo storico/);
  assert.match(worklist, /non possiamo confermare|non è confermato|non verificabile/i);
});

test("COMM-TRUST1.C loading feedback does not masquerade as an empty archive", () => {
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /Caricamento delle attività commerciali/);
  assert.doesNotMatch(loading, /\>0\</);
});
