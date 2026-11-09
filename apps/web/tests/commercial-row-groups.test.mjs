import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("../lib/commercial-row-groups.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { groupCommercialRows } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const row = (n, extra = {}) => ({ key: "k" + n, kind: "inbound-order", title: "Rossi Tubi", at: "2026-11-09T10:00:00Z", ...extra });

test("tre o più righe consecutive uguali nello stesso giorno diventano un gruppo", () => {
  const out = groupCommercialRows([row(1), row(2), row(3)]);
  assert.equal(out.length, 1);
  assert.equal(out[0].type, "group");
  assert.equal(out[0].items.length, 3);
});

test("due righe restano singole e l'ordine non cambia", () => {
  const out = groupCommercialRows([row(1), row(2)]);
  assert.deepEqual(out.map((e) => e.type), ["single", "single"]);
  assert.deepEqual(out.map((e) => e.item.key), ["k1", "k2"]);
});

test("cliente, tipo o giorno diversi interrompono il gruppo", () => {
  const out = groupCommercialRows([
    row(1), row(2), row(3, { title: "Bianchi" }), row(4), row(5, { at: "2026-11-08T10:00:00Z" }), row(6, { kind: "inbound-rfq" }),
  ]);
  assert.deepEqual(out.map((e) => e.type), ["single", "single", "single", "single", "single", "single"]);
});

test("righe senza data non vengono raggruppate e nessuna riga si perde", () => {
  const items = [row(1, { at: null }), row(2, { at: null }), row(3, { at: null }), row(4), row(5), row(6)];
  const out = groupCommercialRows(items);
  assert.equal(out.filter((e) => e.type === "group").length, 1);
  const flat = out.flatMap((e) => (e.type === "group" ? e.items : [e.item]));
  assert.deepEqual(flat.map((i) => i.key), items.map((i) => i.key));
});

test("il giorno segue il fuso di Roma", () => {
  const same = groupCommercialRows([
    row(1, { at: "2026-11-09T08:00:00Z" }), row(2, { at: "2026-11-09T15:00:00Z" }), row(3, { at: "2026-11-09T22:30:00Z" }),
  ]);
  assert.equal(same.length, 1);
  assert.equal(same[0].day, "2026-11-09");
  // 23:30 UTC è già il 10 novembre a Roma: non appartiene al gruppo del 9.
  const split = groupCommercialRows([
    row(1, { at: "2026-11-09T22:30:00Z" }), row(2, { at: "2026-11-09T23:30:00Z" }), row(3, { at: "2026-11-10T08:00:00Z" }),
  ]);
  assert.deepEqual(split.map((e) => e.type), ["single", "single", "single"]);
});
