import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("../lib/commercial-row-lines.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { summarizeRowLines } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("pulisce i trattini decorativi e mantiene le sigle di materiale", () => {
  const r = summarizeRowLines([{ raw_spec_text: "EN 10219 tubolare S355J2H-3.1-CE 80x80x10 ----- L: 6000 ----- 105 barre", requested_quantity: "105.000", quantity_unit: "PZ" }]);
  assert.equal(r.material, "EN 10219 tubolare S355J2H-3.1-CE 80x80x10 · L: 6000 · 105 barre");
  assert.equal(r.quantity, "105 pz");
});

test("segnala le righe aggiuntive senza mostrarle tutte", () => {
  assert.equal(summarizeRowLines([{ raw_spec_text: "a", quantity: 2, quantity_unit: "T" }, { raw_spec_text: "b" }]).material, "a · +1 riga");
  const many = [1, 2, 3, 4].map((i) => ({ raw_spec_text: "x" + i, quantity: i, quantity_unit: "PZ" }));
  assert.match(summarizeRowLines(many).material, /altre righe$/);
});

test("senza righe o con dati non numerici non inventa nulla", () => {
  assert.deepEqual(summarizeRowLines([]), {});
  assert.deepEqual(summarizeRowLines(null), {});
  assert.equal(summarizeRowLines([{ raw_spec_text: "x", quantity: "n.d.", quantity_unit: "PZ" }]).quantity, undefined);
});

test("le query della lista leggono le righe con la relazione esplicita e un limite", () => {
  const streams = read("../lib/commercial-unified-streams.ts");
  assert.match(streams, /rfq_lines!rfq_lines_rfq_id_fkey\(/);
  assert.match(streams, /offer_lines!offer_lines_offer_id_fkey\(/);
  assert.match(streams, /order_lines!order_lines_order_id_fkey\(/);
  assert.equal((streams.match(/limit\(ROW_LINES_FETCHED, \{ referencedTable:/g) ?? []).length, 3);
  assert.doesNotMatch(streams, /price_value|unit_price/, "nessun prezzo nella lista");
});
