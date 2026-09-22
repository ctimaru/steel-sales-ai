import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/relationships/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/relationships/page.tsx", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../app/(workspace)/review/relationships/relationship-activation-button.tsx", import.meta.url), "utf8");
const coverage = fs.readFileSync(new URL("../app/(workspace)/review/coverage/page.tsx", import.meta.url), "utf8");

test("PA2.21 loads relationship readiness from the controlled RPC", () => {
  assert.match(actions, /p1_operational_relationship_readiness/);
  assert.match(actions, /p_organization_id/);
  assert.match(page, /shared normalized conversation/i);
  assert.match(page, /exact product multiset/i);
  assert.match(page, /candidato unico/i);
});

test("relationship activation is explicit and single-candidate", () => {
  assert.match(actions, /p1_activate_operational_relationship/);
  assert.match(button, /Collega Offer → RFQ/);
  assert.match(button, /Collega Order → Offer/);
  assert.match(button, /Collega Order → RFQ/);
  assert.match(page, /Bulk auto-activation: disabilitata/);
});

test("PA2.21 forbids unsafe relationship inference", () => {
  assert.match(page, /Nessuna inferenza da cliente/);
  assert.match(page, /dominio email/);
  assert.match(page, /thread legacy/);
  assert.match(coverage, /review\/relationships/);
});
