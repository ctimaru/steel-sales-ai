import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/commercial/reengagement/actions.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/commercial/reengagement/page.tsx", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("P2.1 uses a tenant-scoped deterministic RPC", () => {
  assert.match(actions, /p2_reengagement_signals/);
  assert.match(actions, /p_organization_id: membership\.organization_id/);
  assert.match(actions, /p_watch_after_days: 45/);
  assert.match(actions, /p_dormant_after_days: 90/);
});

test("P2.1 exposes explainable re-engagement signals without predictive scoring", () => {
  assert.match(page, /Riattivazione commerciale/);
  assert.match(page, /nessun punteggio predittivo/i);
  assert.match(page, /reason_codes/);
  assert.match(page, /Apri evidenza/);
  assert.match(page, /Apri Company 360/);
  assert.match(page, /non crea segnali sintetici/i);
});

test("P2.1 is wired into canonical Commercial Intelligence navigation", () => {
  assert.match(routes, /reengagement: "\/commercial\/reengagement"/);
  assert.match(shell, /Commercial Intelligence/);
  assert.match(shell, /Riattivazione commerciale/);
});
