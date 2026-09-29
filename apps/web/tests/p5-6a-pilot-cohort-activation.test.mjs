import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(
  new URL("../lib/routes.ts", import.meta.url),
  "utf8",
);
const navigation = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);
const platformHome = fs.readFileSync(
  new URL("../app/(platform)/platform/page.tsx", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(platform)/platform/pilot/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(platform)/platform/pilot/actions.ts", import.meta.url),
  "utf8",
);
const client = fs.readFileSync(
  new URL("../lib/platform-pilot.ts", import.meta.url),
  "utf8",
);

test("P5.6A exposes an owner-only Pilot Control Room", () => {
  assert.match(routes, /pilot:\s*"\/platform\/pilot"/);
  assert.match(navigation, /label:\s*"Commercial Pilot"/);
  assert.match(navigation, /href:\s*appRoutes\.platform\.pilot/);
  assert.match(page, /requirePlatformSuperadmin\(\)/);
  assert.match(actions, /requirePlatformSuperadmin\(\)/);
  assert.match(platformHome, /Pilot Cohort &amp; Activation/);
});

test("P5.6A keeps candidate selection separate from activation readiness", () => {
  assert.match(page, /Aziende selezionate/);
  assert.match(page, /Candidate pool/);
  assert.match(page, /ReadinessBadge/);
  assert.match(page, /network_company_link_required/);
  assert.match(page, /supplier_technical_scope_required/);
  assert.match(actions, /p5_6a_upsert_participant/);
  assert.match(actions, /p5_6a_transition_participant/);
});

test("P5.6A does not fake pilot evidence or opportunity unlocks", () => {
  assert.match(page, /no synthetic usage/);
  assert.match(page, /non sblocca singole opportunità/);
  assert.match(page, /marketplace_access/);
  assert.doesNotMatch(actions, /p5_3_marketplace_detail/);
  assert.doesNotMatch(actions, /marketplace_unlocks/);
  assert.match(client, /p5_6a_pilot_control/);
});
