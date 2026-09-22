import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const data = fs.readFileSync(new URL("../lib/commercial-data.ts", import.meta.url), "utf8");
const explorer = fs.readFileSync(new URL("../components/commercial-explorer.tsx", import.meta.url), "utf8");

test("PA2.19 Explorer uses the normalized union RPC", () => {
  assert.match(data, /p1_normalized_commercial_explorer/);
  assert.match(data, /p_organization_id/);
  assert.doesNotMatch(data, /getExplorerData[\s\S]*?\.from\("rfq_lines"\)/);
});

test("Explorer maps all operational normalized roles", () => {
  assert.match(data, /row\.role as ItemRole/);
  assert.match(data, /sourceKind: "normalized"/);
  assert.match(explorer, /RFQ \/ Offer \/ Order/);
});

test("Delivery remains evidence-only and outside the operational union", () => {
  assert.match(data, /filters\.role === "delivered"/);
  assert.match(explorer, /Delivered · evidence only/);
});
