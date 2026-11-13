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
