import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/commercial/demand/actions.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/commercial/demand/page.tsx", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("P2.2 uses a tenant-scoped deterministic RFQ demand RPC", () => {
  assert.match(actions, /p2_demand_signals/);
  assert.match(actions, /p_organization_id: membership\.organization_id/);
  assert.match(actions, /p_window_days: windowDays/);
  assert.match(actions, /type DemandWindow = 30 \| 90/);
});

test("P2.2 distinguishes account demand from multi-account demand", () => {
  assert.match(page, /Domanda ripetuta account/);
  assert.match(page, /Domanda multi-account/);
  assert.match(page, /Non è una stima di mercato/);
  assert.doesNotMatch(page, /market demand/i);
});

test("P2.2 preserves evidence and never aggregates incompatible units", () => {
  assert.match(page, /Quantità osservate/);
  assert.match(page, /mai sommate tra unità diverse/);
  assert.match(page, /RFQ che costituiscono il segnale/);
  assert.match(page, /Apri Product 360/);
  assert.match(page, /Company 360/);
});

test("P2.2 exposes attribution quality and truthful empty state", () => {
  assert.match(page, /RFQ non attribuite/);
  assert.match(page, /non possono creare\s+segnali account-based/i);
  assert.match(page, /non crea segnali sintetici/i);
  assert.match(page, /Apri revisione identità/);
});

test("P2.2 is wired into canonical Commercial Intelligence navigation", () => {
  assert.match(routes, /demand: "\/commercial\/demand"/);
  assert.match(shell, /Commercial Intelligence/);
  assert.match(shell, /Segnali di domanda/);
});
