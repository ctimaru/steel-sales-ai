import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(new URL("../app/(workspace)/layout.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/alerts/page.tsx", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../app/(workspace)/alerts/actions.ts", import.meta.url), "utf8");

test("PA2.30.27 wires tenant-safe alert read model into the workspace shell", () => {
  assert.match(layout, /p1_operational_alerts_summary/);
  assert.match(shell, /appRoutes\.operations\.alerts/);
  assert.match(shell, /alertNeedsAttention/);
  assert.match(page, /p1_operational_alerts_read/);
  assert.match(page, /p1_operational_alerts_summary/);
  assert.doesNotMatch(page, /\.from\("operational_alerts"\)/);
});

test("operational alert actions use controlled RPCs", () => {
  assert.match(actions, /p1_acknowledge_operational_alert/);
  assert.match(actions, /p1_resolve_operational_alert/);
  assert.match(actions, /revalidatePath\("\/alerts"\)/);
  assert.match(page, /OperationalAlertActions/);
});

test("alert surface exposes attention and lifecycle states", () => {
  assert.match(page, /Richiede attenzione/);
  assert.match(page, /Controlli regolari/);
  assert.match(page, /In carico/);
  assert.match(page, /Risolti/);
});
