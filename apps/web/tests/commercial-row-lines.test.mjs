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
  const spec = (n) => ({ raw_spec_text: "EN 10219 80x80x" + n, quantity: n, quantity_unit: "T" });
  assert.equal(summarizeRowLines([spec(5), spec(6)]).material, "EN 10219 80x80x5 · +1 riga");
  assert.match(summarizeRowLines([spec(1), spec(2), spec(3), spec(4)]).material, /\+ altre righe$/);
});

test("sceglie la riga che sembra un materiale e ignora le frasi delle email", () => {
  const r = summarizeRowLines([
    { raw_spec_text: "come da accordi telefonici, mettere in ordine per Bologna due pacchi", quantity: 20, quantity_unit: "PZ" },
    { raw_spec_text: "EN 10219 tubolare S355J2H 80x80x10 ---- L: 12000", quantity: 9, quantity_unit: "PZ" },
  ]);
  assert.equal(r.material, "EN 10219 tubolare S355J2H 80x80x10 · L: 12000 · +1 riga");
  assert.equal(r.quantity, "9 pz");
  // Le misure dopo un discorso non bastano: è una frase, non un materiale.
  assert.deepEqual(summarizeRowLines([{ raw_spec_text: "fai attenzione: mi hai inserito 2 pacchi di 193,7x6 L. 12000", quantity: 7, quantity_unit: "PZ" }]), {});
});

test("nella lista non compaiono importi in euro", () => {
  const a = summarizeRowLines([{ raw_spec_text: "193,7x10 a 12000 25 ton disponibile ----- € 780,50/ton franco", quantity: 25, quantity_unit: "T" }]);
  assert.doesNotMatch(a.material, /€|\d+,\d+\/ton/);
  assert.equal(summarizeRowLines([{ raw_spec_text: "168,3x4 a 920 euro/t", quantity: 5, quantity_unit: "PZ" }]).material, "168,3x4");
});

test("senza righe o con dati non numerici non inventa nulla", () => {
  assert.deepEqual(summarizeRowLines([]), {});
  assert.deepEqual(summarizeRowLines(null), {});
  assert.equal(summarizeRowLines([{ raw_spec_text: "80x80x5", quantity: "n.d.", quantity_unit: "PZ" }]).quantity, undefined);
});

test("le query della lista leggono le righe con la relazione esplicita e un limite", () => {
  const streams = read("../lib/commercial-unified-streams.ts");
  assert.match(streams, /rfq_lines!rfq_lines_rfq_id_fkey\(/);
  assert.match(streams, /offer_lines!offer_lines_offer_id_fkey\(/);
  assert.match(streams, /order_lines!order_lines_order_id_fkey\(/);
  assert.equal((streams.match(/limit\(ROW_LINES_FETCHED, \{ referencedTable:/g) ?? []).length, 3);
  assert.doesNotMatch(streams, /price_value|unit_price/, "nessun prezzo nella lista");
});
