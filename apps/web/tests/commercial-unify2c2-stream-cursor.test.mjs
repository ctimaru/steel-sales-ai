import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const stream = read("../lib/commercial-unified-streams.ts");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const list = read("../components/commercial-unified-worklist.tsx");
const operations = read("../components/commercial-campaign-operations.tsx");

test("COMMERCIAL-UNIFY2C.2 composes all real entity sources, no normalized line duplication", () => {
  for (const source of [
    "rfqs", "offers", "orders", "buyer_rfq_campaigns", "buyer_rfq_quotes",
    "buyer_purchase_order_drafts", "buyer_distintas",
  ]) assert.match(stream, new RegExp('from\\("' + source + '"\\)'));
  assert.doesNotMatch(stream, /getExplorerData|p1_normalized_commercial_explorer/);
  assert.match(stream, /["']all["']|all: ids/);
  assert.match(stream, /offers: \["offers", "quotes"\]/);
  assert.match(stream, /orders: \["orders", "purchaseOrders"\]/);
  assert.match(stream, /STREAM_PAGE_SIZE = 30/);
  assert.match(stream, /FETCH_PER_STREAM = STREAM_PAGE_SIZE \+ 1/);
  assert.match(page, /isStreamView\(view\)/);
  assert.match(page, /loadCommercialStreams\(\{ organizationId: context\.organizationId, view, query, cursor: params\.cursor \}\)/);
});

test("COMMERCIAL-UNIFY2C.2 maintains strict RLS, scoped searches and fails closed", () => {
  assert.match(stream, /createClient\(\)/);
  assert.match(stream, /\.eq\("organization_id", organizationId\)/);
  assert.match(stream, /!inner\(title\)/);
  assert.match(stream, /if \(failures\)/);
  assert.match(stream, /partial: true/);
  assert.match(stream, /inboundUnavailable:/);
  assert.match(stream, /procurementUnavailable:/);
  assert.match(stream, /safeQuery/);
  assert.match(stream, /count: "exact"/);
  assert.doesNotMatch(stream, /service_role|SUPABASE_SERVICE_ROLE_KEY|SECURITY DEFINER|sendBuyerRfq/);
});

test("COMMERCIAL-UNIFY2C.2 stable deterministic merge returns consumed offsets and exact counts", () => {
  assert.match(stream, /order\("created_at", \{ ascending: false \}\)/);
  assert.match(stream, /order\("id", \{ ascending: false \}\)/);
  assert.match(stream, /const ordered = flat\.sort/);
  assert.match(stream, /firstPage = ordered\.slice\(0, STREAM_PAGE_SIZE\)/);
  assert.match(stream, /for \(const row of firstPage\) nextOffsets\[row\.source\]\+\+/);
  assert.match(stream, /batches\.reduce\(\(sum, x\) => sum \+ \(x\.total \?\? 0\), 0\)/);
  assert.match(stream, /history: \[\.\.\.state\.history, toVector\(state\.offsets\)\]/);
  assert.match(stream, /previousCursor: prevCursor/);
  assert.match(stream, /currentCursor: state\.page > 1 \? encode\(state\) : null/);
});

test("COMMERCIAL-UNIFY2C.2 validates navigation cursor without making it an authorization boundary", () => {
  assert.match(stream, /value\.length > 16000/);
  assert.match(stream, /candidate\.view !== view/);
  assert.match(stream, /candidate\.query !== query/);
  assert.match(stream, /validOffsets\(candidate\.offsets\)/);
  assert.match(stream, /candidate\.history\.every\(validVector\)/);
  assert.match(stream, /candidate\.page > MAX_HISTORY/);
  assert.match(stream, /MAX_HISTORY = 200/);
  assert.match(stream, /fromVector\(state\.history\[state\.history\.length - 1\]\)/);
  assert.match(stream, /authorization/);
  assert.match(list, /mergedCommercialHref\(view, query, data\.paging\.nextCursor \?\? undefined\)/);
  assert.match(list, /mergedCommercialHref\(view, query, data\.paging\.previousCursor \?\? undefined\)/);
  assert.match(list, /cursor=\{data\.paging\?\.currentCursor\}/);
  assert.match(operations, /cursor && isStreamView\(view\)/);
});

test("COMMERCIAL-UNIFY2C.2 keeps human-in-control mutations and deep links unchanged", () => {
  assert.match(list, /CommercialCampaignOperations/);
  assert.match(operations, /canExecuteCritical/);
  assert.match(stream, /appRoutes\.commercial\.rfq\(id\)/);
  assert.match(stream, /appRoutes\.commercial\.offer\(id\)/);
  assert.match(stream, /appRoutes\.commercial\.order\(id\)/);
  assert.match(stream, /appRoutes\.rfqHub\.campaign\(campaignId \?\? id\)/);
});
