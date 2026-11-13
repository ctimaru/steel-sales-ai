import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");

test("Commerciale: gli stati che chiedono azione risaltano sugli esiti", () => {
  // COMM-DESK-AI1.B: la regola di urgenza vive in lib/commercial-row-urgency.ts.
  assert.match(src, /commercialRowUrgency\(item\.kind, item\.status, item\.rowFacts\?\.dueAt, now\)/);
  assert.match(src, /statusDotClass\[tone\]/);
  assert.match(src, /statusTextClass\[tone\]/);
});

test("Commerciale: i gruppi non ripetono il titolo quando il cliente manca", () => {
  assert.match(src, /sameAsType \? "" : type/);
  assert.doesNotMatch(src, /groupCommercialRows|mostra\/nascondi/); // COMM-CLEAN-LIST1: elenco piatto
  assert.doesNotMatch(src, /entry\.items\.length\} × /);
});

test("Commerciale: la riga selezionata resta evidenziata e il gruppo che la contiene si apre", () => {
  assert.match(src, /sortByCommercialUrgency\(filtered, urgencyOf\)/);
  assert.match(src, /renderRow\(item\)/);
  assert.match(src, /item\.key === active\?\.key \? "bg-\[#edf6f0\]"/);
});
