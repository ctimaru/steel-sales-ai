import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("../lib/commercial-row-lines.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { summarizeRowLines } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("una sola riga: numero di righe e quantità con unità", () => {
  assert.deepEqual(summarizeRowLines([{ requested_quantity: "105.000", quantity_unit: "PZ" }]), { lines: "1 riga", quantity: "105 pz" });
  assert.deepEqual(summarizeRowLines([{ quantity: 25, quantity_unit: "T" }]), { lines: "1 riga", quantity: "25 t" });
});

test("più righe: solo il conteggio, mai una quantità mista", () => {
  assert.deepEqual(summarizeRowLines([{ quantity: 2, quantity_unit: "T" }, { quantity: 5, quantity_unit: "PZ" }]), { lines: "2 righe", quantity: undefined });
  const many = [1, 2, 3, 4].map((n) => ({ quantity: n, quantity_unit: "PZ" }));
  assert.equal(summarizeRowLines(many).lines, "4+ righe");
});

test("senza righe o con dati non numerici non inventa nulla", () => {
  assert.deepEqual(summarizeRowLines([]), {});
  assert.deepEqual(summarizeRowLines(null), {});
  assert.equal(summarizeRowLines([{ quantity: "n.d.", quantity_unit: "PZ" }]).quantity, undefined);
});

test("la lista non legge né mostra testo libero delle email né prezzi", () => {
  const streams = read("../lib/commercial-unified-streams.ts");
  assert.doesNotMatch(streams, /raw_spec_text|source_text|price_value|unit_price|notes/);
  assert.match(streams, /rfq_lines!rfq_lines_rfq_id_fkey\(requested_quantity,quantity_unit,created_at\)/);
  assert.match(streams, /offer_lines!offer_lines_offer_id_fkey\(quantity,quantity_unit,created_at\)/);
  assert.match(streams, /order_lines!order_lines_order_id_fkey\(quantity,quantity_unit,created_at\)/);
  assert.equal((streams.match(/limit\(ROW_LINES_FETCHED, \{ referencedTable:/g) ?? []).length, 3);
  const summarizer = read("../lib/commercial-row-lines.ts");
  assert.doesNotMatch(summarizer, /raw_spec_text|source_text|material/);
});

test("gli ordini mostrano il riferimento del cliente, campo strutturato", () => {
  const streams = read("../lib/commercial-unified-streams.ts");
  assert.match(streams, /customer_order_ref,company:companies!orders_company_id_fkey\(name\)/);
  assert.match(streams, /orderReference\(r\.customer_order_ref\)/);
});
