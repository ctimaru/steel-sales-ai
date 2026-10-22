import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const query = read("../lib/commercial-unified-paged.ts");
const types = read("../lib/commercial-unified-data.ts");
const home = read("../app/(italian)/(workspace)/commercial/page.tsx");
const worklist = read("../components/commercial-unified-worklist.tsx");
const tabs = read("../components/commercial-campaign-operations.tsx");

test("COMMERCIAL-UNIFY2C pages sent RFQs and saved draft lists inside SQL under tenant RLS", () => {
  assert.match(query, /export const COMMERCIAL_PAGE_SIZE = 30/);
  assert.match(query, /isCommercialPagedView/);
  assert.match(query, /parseCommercialPage/);
  assert.match(query, /view === "sent"/);
  assert.match(query, /"buyer_rfq_campaigns"/);
  assert.match(query, /"buyer_distintas"/);
  assert.match(query, /\.eq\("organization_id", organizationId\)/);
  assert.match(query, /\.range\(start, start \+ COMMERCIAL_PAGE_SIZE - 1\)/);
  assert.match(query, /\.select\("id,title,status,due_at,created_at", \{ count: "exact" \}\)/);
  assert.match(query, /\.select\("id,title,line_count,created_at", \{ count: "exact" \}\)/);
  assert.match(query, /\.ilike\("title", "%" \+ rawQuery \+ "%"\)/);
  assert.match(query, /safeTitleSearch/);
  assert.match(query, /\.order\("id", \{ ascending: false \}\)/);
  assert.doesNotMatch(query, /service_role|SUPABASE_SERVICE_ROLE_KEY|rpc\("rfqh.*send/);
});

test("COMMERCIAL-UNIFY2C uses existing scoped line-level RPC pagination for received requests", () => {
  assert.match(query, /view === "received"/);
  assert.match(query, /db\.rpc\("commercial_unify_entity_search_v1"/);
  assert.match(query, /organizationId,/);
  assert.match(query, /p_source: "rfqs"/);
  assert.match(query, /p_offset: \(page - 1\) \* COMMERCIAL_PAGE_SIZE/);
  assert.match(query, /return failure\(view, page, COMMERCIAL_PAGE_SIZE\)/);
  assert.match(query, /key: "inbound-rfq:" \+ id/);
  assert.match(query, /exact: true/);
  assert.match(query, /export const COMMERCIAL_PAGE_SIZE = 30/);
  assert.match(query, /total = Number\(payload\.total\)/);
  assert.match(query, /hasNext: page \* COMMERCIAL_PAGE_SIZE < total/);
});

test("COMMERCIAL-UNIFY2C routes only supported views to paged loader", () => {
  assert.match(home, /parseCommercialPage\(params\.page\)/);
  assert.match(home, /isCommercialPagedView\(view\)/);
  assert.match(home, /loadCommercialPagedData\(\{ organizationId: context\.organizationId, view, query, page \}\)/);
  assert.match(home, /loadUnifiedCommercialData\(context\.organizationId\)/);
  assert.match(home, /page=\{page\}/);
  assert.match(types, /paging\?:/);
  assert.match(types, /commercialPageHref/);
  assert.match(worklist, /data\.paging \? data\.items : filterCommercialItems/);
  assert.match(worklist, /data\.paging\.hasNext/);
  assert.match(worklist, /Pagina \{data\.paging\.page\}/);
});

test("COMMERCIAL-UNIFY2C keeps deep links, selected tab and current page", () => {
  assert.match(worklist, /route\(view, query, item\.key, data\.paging\?\.page \?\? page, data\.paging\?\.currentCursor\)/);
  assert.match(worklist, /commercialPageHref\(view, query, page\)/);
  assert.match(tabs, /operationsHref\(view, query, selected, option\.id, page, cursor\)/);
  assert.match(tabs, /commercialPageHref\(view, query, page, selected\)/);
  assert.match(worklist, /page=\{page\}/);
});

test("COMMERCIAL-UNIFY2C keeps mobile detail usable without hiding desktop list or sending actions", () => {
  assert.match(worklist, /active \? "hidden lg:block "/);
  assert.match(worklist, /tabIndex=\{-1\}/);
  assert.match(worklist, /overflow-x-auto/);
  assert.match(worklist, /min-h-11/);
  assert.match(worklist, /Chiudi <span/);
  assert.match(worklist, /Dettaglio nella stessa pagina/);
  assert.match(query, /return failure\(view, page,/);
  assert.doesNotMatch(query + worklist, /send\(|dispatch\(|award\(/);
});
