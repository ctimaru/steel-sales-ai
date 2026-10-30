import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const worklist = read("../components/commercial-unified-worklist.tsx");
const guidance = read("../lib/commercial-deal-next-step.ts");

test("Commerciale selected deal uses contextual guidance without sending any outbound action", () => {
  assert.match(worklist, /data-testid="commercial-deal-next-step"/);
  assert.match(worklist, /href=\{item\.href\}/);
  assert.match(worklist, /commercialDealNextStep\(item\.kind, facts\?\.rawStatus \?\? item\.status, canWrite\)/);
  assert.match(worklist, /\{nextStep\.title\}/);
  assert.match(worklist, /\{nextStep\.description\}/);
  assert.match(worklist, /\{nextStep\.actionLabel\}/);
  for (const kind of ["campaign", "quote", "purchase-order", "distinta"]) {
    assert.match(guidance, new RegExp('kind === "' + kind + '"'));
  }
  assert.match(guidance, /if \(!canWrite\)/);
  assert.match(guidance, /nessun invio da questa scheda/);
  assert.match(worklist, /data-testid="commercial-smart-deal-card"/);
  assert.match(worklist, /<CommercialCampaignOperations/);
});
