import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const launch = read("../components/network-launch-discovery.tsx");
const overview = read("../components/network-discovery-overview.tsx");
const roles = read("../components/network-role-discovery.tsx");
const publicOnly = read("../../../supabase/migrations/20261121193500_net_public_published_only.sql");

test("NET-PUBLIC-ONLY2: empty discovery section is absent, not a misleading zero-company panel", () => {
  assert.match(launch, /if\(!directory\|\|total===0\)return null;/);
  assert.match(launch, /const total=directory\?\.discovered_total\?\?0;/);
});

test("NET-PUBLIC-ONLY2: legacy overview uses only the canonical published total", () => {
  assert.match(overview, /const total = published;/);
  assert.doesNotMatch(overview, /const total = published \+ discovered;/);
  assert.doesNotMatch(overview, /I profili da confermare non sono momentaneamente disponibili/);
  assert.match(overview, /#network-region-results/);
  assert.doesNotMatch(overview, /#network-new-discoveries/);
});

test("NET-PUBLIC-ONLY2: user-facing role copy describes published companies only", () => {
  assert.match(roles, /mostra soltanto profili aziendali pubblicati/);
  assert.doesNotMatch(roles, /aziende scoperte da confermare/);
  assert.doesNotMatch(roles, /località provvisorie/);
});

test("NET-PUBLIC-ONLY2: no SEO/UI-only hiding: data source is blocked at SQL reader", () => {
  assert.match(publicOnly, /CREATE OR REPLACE VIEW private\.netfast_public_visible_records/);
  assert.match(publicOnly, /WHERE false;/);
  assert.match(publicOnly, /target_count <> 12/);
  assert.match(publicOnly, /REVOKE ALL ON private\.netfast_public_visible_records/);
});
