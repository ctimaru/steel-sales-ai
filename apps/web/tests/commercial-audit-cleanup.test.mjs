import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("COMM-AUDIT1: gli stati in ingresso sono tradotti e non vengono più mostrati grezzi", () => {
  const streams = read("lib/commercial-unified-streams.ts");
  for (const [raw, label] of [["new", "Nuova"], ["received", "Ricevuto"], ["sent", "Inviata"]]) {
    assert.match(streams, new RegExp(`${raw}: "${label}"`));
  }
  assert.match(streams, /inboundStatusLabel\(r\.status\)/);
  assert.doesNotMatch(streams, /str\(r\.status, "—"\)/);
});

test("COMM-AUDIT1: ordini senza cliente non ripetono lo stesso testo in titolo e sottotitolo", () => {
  assert.match(read("lib/commercial-unified-streams.ts"), /cliente non indicato/);
});

test("COMM-AUDIT1: la chat RFQ non mostra sigle interne di progetto", () => {
  const chat = read("components/rfqc1-chat-workspace.tsx");
  assert.doesNotMatch(chat, /integrazione in P1/);
  assert.doesNotMatch(chat, /RFQH7/);
});
