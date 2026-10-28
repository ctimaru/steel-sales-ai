import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const worklist = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");

test("COMM-CINE2 displays a responsive two-pane cockpit for every selected deal kind", () => {
  assert.match(worklist, /data-testid="comm-cine2-deal-cockpit"/);
  assert.match(worklist, /data-testid="comm-cine2-split-view"/);
  assert.match(worklist, /lg:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(340px,0\.85fr\)\]/);
  assert.doesNotMatch(worklist, /active\.campaignId \? "grid min-w-0 gap-3"/);
  assert.match(worklist, /lg:sticky lg:top-24/);
});

test("COMM-CINE2 preserves workspace authorization, filtering, paging and source-bound detail", () => {
  assert.match(worklist, /getOperationalEntityData\(inboundKind, item\.id\)/);
  assert.match(worklist, /commercial-compact-filters/);
  assert.match(worklist, /commercial-list-pane/);
  assert.match(worklist, /CommercialCampaignOperations/);
  assert.match(worklist, /Attività non trovata nella vista corrente o non autorizzata/);
  assert.match(worklist, /data-testid="commercial-deal-memory-entry"/);
});
