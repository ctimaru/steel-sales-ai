import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/coverage/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/coverage/page.tsx", import.meta.url), "utf8");

test("coverage workspace calls the tenant-scoped normalization RPC", () => {
  assert.match(actions, /p1_normalization_coverage/);
  assert.match(actions, /organization_memberships/);
  assert.match(actions, /p_organization_id/);
});

test("coverage workspace makes controlled policy explicit", () => {
  assert.match(page, /Questa vista non promuove automaticamente nessun dato/);
  assert.match(page, /Bulk auto-promotion: disabilitata/);
  assert.match(page, /Offer promotion: abilitata solo per thread completi e outbound/);
  assert.match(page, /Backlog controllato/);
});
