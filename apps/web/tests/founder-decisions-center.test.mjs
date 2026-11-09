import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const home = readFileSync(fileURLToPath(new URL("../app/(italian)/(platform)/platform/page.tsx", import.meta.url)), "utf8");
const decisions = readFileSync(fileURLToPath(new URL("../app/(italian)/(platform)/platform/decisions/page.tsx", import.meta.url)), "utf8");

test("founder console exposes a one-click entry without giving staff the founder-only link", () => {
  assert.match(home, /href="\/platform\/decisions"/);
  assert.match(home, /context\.is_platform_owner \? \(/);
  assert.match(home, /Apri le mie decisioni/);
});

test("decisions page is role restricted and based on real authorized queue snapshots", () => {
  assert.match(decisions, /requirePlatformConsoleContext\(\)/);
  assert.match(decisions, /if \(!context\.is_platform_owner\) notFound\(\)/);
  assert.match(decisions, /getPlatformCockpitSnapshot\(context\)/);
  assert.match(decisions, /signal\.status === "verified"/);
  assert.match(decisions, /signal\.value > 0/);
  assert.match(decisions, /unavailable/);
});

test("decisions never approve, publish, or fake a recorded decision from the dashboard", () => {
  assert.doesNotMatch(decisions, /<form|<button|server action|supabase\.from|\.rpc\(/);
  assert.match(decisions, /Nessuna approvazione avviene da questa pagina/);
  assert.match(decisions, /non uno storico delle tue approvazioni/);
  assert.match(decisions, /pending\.slice\(0, 3\)/);
  assert.match(decisions, /<details/);
});

test("each decision explains why it matters, recommendation and postponement", () => {
  for (const text of ["Perché conta:", "Consiglio:", "Se rimandi:", "la scelta da valutare"]) {
    assert.ok(home.includes(text) || decisions.includes(text), text);
  }
});
