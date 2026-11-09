import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");

test("Commerciale: gli stati che chiedono azione risaltano sugli esiti", () => {
  assert.match(src, /actionStatuses = new Set\(\["nuova", "ricevuto", "bozza"/);
  assert.match(src, /statusBadgeClass\[statusTone\(item\.status\)\]/);
  assert.match(src, /rowAccentClass\[statusTone\(item\.status\)\]/);
});

test("Commerciale: i gruppi non ripetono il titolo quando il cliente manca", () => {
  assert.match(src, /cliente non indicato/);
  assert.match(src, /groupLabel\(entry\.items\[0\], itemType\(entry\.items\[0\]\)\)/);
  assert.doesNotMatch(src, /entry\.items\.length\} × /);
});

test("Commerciale: la riga selezionata resta evidenziata e il gruppo che la contiene si apre", () => {
  assert.match(src, /open=\{entry\.items\.some\(\(item\) => item\.key === active\?\.key\)\}/);
  assert.match(src, /border-l-\[#175640\] bg-\[#edf6f0\]/);
});
