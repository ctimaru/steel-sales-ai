import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const shell = read("../components/commercial-ai-native-shell.tsx");
const css = read("../app/globals.css");

test("COMM-DESK-AI1 renders the AI chat together with the desk, never instead of it", () => {
  // No early return: the default landing reaches counters and the deals table.
  assert.doesNotMatch(page, /if \(aiNativeEnabled && !legacyRouteRequested\) \{\s*return/);
  const chat = page.indexOf("<CommercialAiNativeShell canWrite={canWrite} compact />");
  assert.ok(chat > 0);
  assert.ok(page.indexOf("<CommercialDirectorPriorityDesk") < chat);
  assert.ok(chat < page.indexOf("<CommercialRequestSummary"));
  assert.ok(chat < page.indexOf("<CommercialUnifiedWorklist"));
  // The classic hero stays as the rollback path.
  assert.match(page, /aiNativeEnabled \? \(\s*<CommercialAiNativeShell[^]*?\) : \(\s*<section data-testid="comm-cine13-first-workspace"/);
});

test("COMM-DESK-AI1 compact chat has no fixed viewport height and keeps the manual Distinta entry", () => {
  assert.match(shell, /data-layout=\{compact \? "desk" : "full"\}/);
  assert.match(shell, /hidden=\{compact && \(turns\.length === 0 \|\| collapsed\)\}/);
  assert.match(shell, /max-h-\[min\(46dvh,440px\)\]/);
  assert.match(shell, /data-testid="commercial-ai-native-collapse"/);
  assert.match(shell, /data-testid="commercial-ai-native-manual-entry"/);
  assert.match(shell, /\?compose=1#commercial-compose/);
});

test("COMM-DESK-AI1 keeps the Commerciale sidebar visible next to the compact chat", () => {
  const hides = css.match(/:has\(\[data-testid="commercial-ai-native-shell"\][^)]*\)\)?/g) ?? [];
  assert.equal(hides.length, 3);
  for (const rule of hides) assert.match(rule, /:not\(\[data-layout="desk"\]\)/);
});

// ---- COMM-DESK-AI1.B: contatori compatti, righe più parlanti, urgenza ----
const ts = (await import("typescript")).default;
const load = async (path) => {
  const out = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(out).toString("base64"));
};
const urgency = await load("../lib/commercial-row-urgency.ts");
const { summarizeRowLines } = await load("../lib/commercial-row-lines.ts");
const worklist = read("../components/commercial-unified-worklist.tsx");
const summary = read("../components/commercial-request-summary.tsx");
const NOW = Date.parse("2026-11-13T12:00:00Z");

test("COMM-DESK-AI1.B classifica l'urgenza solo da tipo, stato e scadenza", () => {
  const u = (kind, status, due) => urgency.commercialRowUrgency(kind, status, due, NOW);
  assert.equal(u("inbound-order", "Ricevuto"), "reply");
  assert.equal(u("inbound-rfq", "Nuova"), "reply");
  assert.equal(u("quote", "Offerta ricevuta"), "reply");
  assert.equal(u("inbound-rfq", "Aperta", "2026-11-16T00:00:00Z"), "due");
  assert.equal(u("inbound-rfq", "Aperta", "2026-11-01T00:00:00Z"), "due"); // già scaduta
  assert.equal(u("inbound-rfq", "Aperta", "2026-12-20T00:00:00Z"), "reply");
  assert.equal(u("campaign", "Bozza"), "draft");
  assert.equal(u("campaign", "Raccolta offerte", "2026-11-15T00:00:00Z"), "due");
  assert.equal(u("campaign", "Chiusa", "2026-11-15T00:00:00Z"), "done");
  assert.equal(u("distinta", "Salvata"), "progress");
  assert.equal(u("inbound-offer", "Inviata"), "progress");
  assert.equal(u("inbound-rfq", "Aperta", "non-una-data"), "reply");
});

test("COMM-DESK-AI1.B ordina per urgenza senza perdere l'ordine cronologico", () => {
  const rows = [
    { id: "a", u: "progress" }, { id: "b", u: "reply" }, { id: "c", u: "draft" },
    { id: "d", u: "reply" }, { id: "e", u: "due" }, { id: "f", u: "done" },
  ];
  assert.deepEqual(urgency.sortByCommercialUrgency(rows, (row) => row.u).map((row) => row.id), ["e", "b", "d", "c", "a", "f"]);
  assert.equal(urgency.commercialRowGroup("due"), "now");
  assert.equal(urgency.commercialRowGroup("draft"), "complete");
  assert.equal(urgency.commercialRowGroup("done"), "rest");
  assert.equal(urgency.commercialDueLabel("2026-11-16T00:00:00Z", "16 nov 2026", NOW), "Scade il 16 nov 2026");
  assert.equal(urgency.commercialDueLabel("2026-11-01T00:00:00Z", "01 nov 2026", NOW), "Scaduta il 01 nov 2026");
  assert.equal(urgency.commercialDueLabel(undefined, "—", NOW), null);
});

test("COMM-DESK-AI1.B somma le quantità solo con righe complete e stessa unità", () => {
  assert.deepEqual(summarizeRowLines([{ quantity: 2, quantity_unit: "T" }, { quantity: "3.5", quantity_unit: "ton" }]),
    { lines: "2 righe", quantity: "tot. 5,5 t" });
  assert.equal(summarizeRowLines([{ quantity: 2, quantity_unit: "T" }, { quantity: 5, quantity_unit: "PZ" }]).quantity, undefined);
  assert.equal(summarizeRowLines([{ quantity: 2, quantity_unit: "T" }, { quantity: null, quantity_unit: "T" }]).quantity, undefined);
  assert.equal(summarizeRowLines([1, 2, 3, 4].map((n) => ({ quantity: n, quantity_unit: "T" }))).quantity, undefined);
});

test("COMM-DESK-AI1.B mostra controparte, riferimento cliente e scadenza; contatori su una riga", () => {
  assert.match(worklist, /\[sameAsType \? "" : type, counterparty, customerRef, reference, detail\]/);
  assert.match(worklist, /data-testid="commercial-row-due"/);
  assert.match(worklist, /data-testid="commercial-urgency-group"/);
  assert.match(worklist, /const showGroups = groupCounts\.size > 1/);
  // Nessun testo libero né importi nella riga: resta la decisione del 9 nov.
  assert.doesNotMatch(worklist.slice(worklist.indexOf("const renderRow"), worklist.indexOf("return (\n    <section id=\"commercial-worklist\"")), /totalEur|material|subtitle/);
  assert.match(summary, /min-h-14/);
  assert.doesNotMatch(summary, /text-\[2\.6rem\]/);
  assert.match(summary, /data-testid=\{"commercial-summary-" \+ target\}/);
});
