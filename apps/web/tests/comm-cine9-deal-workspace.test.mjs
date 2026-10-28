import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");

test("COMM-CINE9 upgrades the deal workspace without replacing real operational data", () => {
  assert.match(source, /comm-cine9-workspace-heading/);
  assert.match(source, /Deal cockpit/);
  assert.match(source, /data\.paging\?\.exact/);
  assert.match(source, /filtered\.length/);
  assert.match(source, /commercial-compact-filters/);
  assert.match(source, /commercial-list-pane/);
  assert.match(source, /lg:sticky lg:top-24/);
});

test("COMM-CINE9 retains explicit commercial workflows and tenant-bound selected detail", () => {
  assert.match(source, /getOperationalEntityData\(inboundKind, item\.id\)/);
  assert.match(source, /<SelectedDetail item=\{active\}/);
  assert.match(source, /CommercialCampaignOperations/);
  assert.match(source, /data-testid="commercial-deal-memory-entry"/);
  assert.match(source, /Attività non trovata nella vista corrente o non autorizzata/);
});
