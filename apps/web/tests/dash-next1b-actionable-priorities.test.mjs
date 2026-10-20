import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const dashboard = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const paged = read("../lib/commercial-unified-paged.ts");

const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function mockPaged(response = { data: null, error: null }) {
  const calls = [];
  const query = {
    select(fields) { calls.push(["select", fields]); return this; },
    eq(field, value) { calls.push(["eq", field, value]); return this; },
    async maybeSingle() { calls.push(["maybeSingle"]); return response; },
  };
  const exports = {};
  const compiled = ts.transpileModule(paged, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, Date, String, Number, Math, Promise,
    require(name) {
      if (name === "server-only") return {};
      if (name === "@/lib/commercial-data") return { getExplorerData: () => null };
      if (name === "@/lib/commercial-unified-data") return {};
      if (name === "@/lib/rfq-hub-overview") return { rfqCampaignStatusLabel: (v) => v };
      if (name === "@/lib/routes") return { appRoutes: { rfqHub: { campaign: (id) => "/rfq-hub/" + id } } };
      if (name === "@/lib/supabase/server") return {
        createClient: async () => ({ from: (table) => { calls.push(["from", table]); return query; } }),
      };
      throw new Error("Unknown import " + name);
    },
  });
  return { load: exports.includeSelectedCommercialCampaign, calls };
}

const empty = () => ({
  items: [], partial: false, inboundUnavailable: false, procurementUnavailable: false,
  truncated: false, paging: { page: 1, pageSize: 30, total: 45, hasNext: true, exact: true },
});

test("NEXT1B deep links resolve an older RFQ only with tenant RLS and exact ID", async () => {
  const { load, calls } = mockPaged({
    data: { id: UUID, title: "Tubi EN 10219", status: "launched", due_at: null, created_at: "2026-10-10T10:00:00Z" },
    error: null,
  });
  const result = await load("own-org", "campaign:" + UUID, empty());
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].key, "campaign:" + UUID);
  assert.equal(result.items[0].origin, "acquisti privati");
  assert.deepEqual(calls.filter((x) => x[0] === "eq").map((x) => [...x]), [
    ["eq", "organization_id", "own-org"], ["eq", "id", UUID],
  ]);
  assert.equal(calls.filter((x) => x[0] === "from")[0][1], "buyer_rfq_campaigns");
  assert.equal(result.paging?.page, 1);
});

test("NEXT1B selected campaign rejects foreign/missing records, malformed keys, duplicate reads", async () => {
  const unavailable = mockPaged();
  const data = empty();
  const result = await unavailable.load("own-org", "campaign:" + UUID, data);
  assert.equal(result, data);
  assert.equal(result.items.length, 0);

  const malformed = mockPaged();
  assert.equal(await malformed.load("own-org", "campaign:../../other", data), data);
  assert.equal(malformed.calls.length, 0);

  const alreadyListed = mockPaged();
  const withMatch = { ...data, items: [{ key: "campaign:" + UUID }] };
  assert.equal(await alreadyListed.load("own-org", "campaign:" + UUID, withMatch), withMatch);
  assert.equal(alreadyListed.calls.length, 0);
});

test("NEXT1B Home priorities are actionable, bounded, and open unified Commerciale", () => {
  assert.match(dashboard, /rfqh10_procurement_inbox/);
  assert.match(dashboard, /\.filter\(\(item\) => item\.requires_action === true/);
  assert.match(dashboard, /\.slice\(0, 3\)/);
  assert.match(dashboard, /\.sort\(\(a, b\) => Number\(b\.priority === "urgent"\)/);
  assert.match(dashboard, /"\?view=sent&item=campaign:" \+ item\.rfq_id!/);
  assert.match(dashboard, /Da fare adesso/);
  assert.match(dashboard, /item\.detail\.trim\(\)\.slice\(0, 170\)/);
  assert.match(dashboard, /Cosa richiede attenzione/);
  assert.doesNotMatch(dashboard, /href: appRoutes\.rfqHub\.inbox/);
  assert.match(dashboard, /Nessun dato dimostrativo viene mostrato come reale/);
});

test("NEXT1B Commerciale selected RFQ fallback is on-demand and never cross-tenant", () => {
  assert.match(commercial, /view === "sent" && selected\.startsWith\("campaign:"\)/);
  assert.match(commercial, /includeSelectedCommercialCampaign\(context\.organizationId, selected, unified\)/);
  assert.match(commercial, /data=\{displayedUnified\}/);
  assert.match(paged, /\.eq\("organization_id", organizationId\)/);
  assert.match(paged, /\.eq\("id", match\[1\]\)/);
  assert.match(paged, /if \(result\.error \|\| !result\.data \|\| !isUuid\(result\.data\.id\)\) return data/);
});

test("NEXT1B historic totals are not mistaken for actionable counts or an empty company", () => {
  assert.match(dashboard, /Totali registrati · non rappresentano attività aperte/);
  assert.match(dashboard, /mode === "live"/);
  assert.match(dashboard, /non ci sono movimenti recenti in questa vista/);
  assert.match(dashboard, /Apri attività commerciali/);
  assert.match(dashboard, /procurementSummary\.attention_total/);
  assert.match(dashboard, /procurementSummary\.active_rfqs/);
  assert.match(dashboard, /href: appRoutes\.marketplace\.home/);
});
