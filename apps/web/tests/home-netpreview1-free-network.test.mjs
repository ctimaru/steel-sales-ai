import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const logic = read("../lib/dashboard-free-network-preview.ts");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const radar = read("../components/dashboard-discovery-feed.tsx");

const compiled = ts.transpileModule(logic, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox);
const { selectFreeNetworkPreview } = sandbox.exports;

const id = (n) => "00000000-0000-4000-8000-00000000000" + n;
const company = (n, extra = {}) => ({
  id: id(n), legal_name: "Azienda " + n + " S.r.l.", trading_name: null, country_code: "it",
  verification_status: "unverified", roles: [{ key: "producer", name: "Produttore", is_primary: true }],
  location: { city: "Brescia", region: "Lombardia" }, ...extra,
});

test("HOME-NETPREVIEW1 formats the first published companies with role and place", () => {
  const preview = selectFreeNetworkPreview({ items: [company(1), company(2, { trading_name: "Tubi Due", verification_status: "verified" })], total: 278 }, "Claudio Timaru");
  assert.equal(preview.total, 278);
  assert.equal(preview.companies.length, 2);
  assert.equal(preview.companies[0].name, "Azienda 1 S.r.l.");
  assert.equal(preview.companies[0].role, "Produttore");
  assert.equal(preview.companies[0].place, "Brescia · IT");
  assert.equal(preview.companies[1].name, "Tubi Due", "trading name preferred");
  assert.equal(preview.companies[1].verified, true);
});

test("HOME-NETPREVIEW1 limits to three, skips own company and malformed rows", () => {
  const items = [
    company(1, { legal_name: "Claudio Timaru" }),
    { id: "not-a-uuid", legal_name: "X" },
    company(2, { legal_name: "  " }),
    company(3), company(4), company(5), company(6),
  ];
  const preview = selectFreeNetworkPreview({ items, total: 10 }, "claudio timaru");
  assert.deepEqual(Array.from(preview.companies, (c) => c.id), [id(3), id(4), id(5)]);
});

test("HOME-NETPREVIEW1 null or invalid page stays distinguishable from an empty catalog", () => {
  assert.equal(selectFreeNetworkPreview(null, "A"), null);
  assert.equal(selectFreeNetworkPreview({ items: "nope" }, "A"), null);
  const empty = selectFreeNetworkPreview({ items: [], total: 0 }, "A");
  assert.equal(empty.companies.length, 0);
  assert.equal(empty.total, 0);
  assert.equal(selectFreeNetworkPreview({ items: [company(1)], total: -4 }, "A").total, 1);
});

test("HOME-NETPREVIEW1 Home uses the same free, published browse RPC as /network and only without Pro", () => {
  assert.match(home, /const freeNetworkReadEnabled = networkEnabled && !networkEntitled && isNetworkFreeReadEnabled\(\)/);
  assert.match(home, /getNetworkBrowsePage\(context\.organizationId, "free", "published", \{ page: 1 \}\)\.catch\(\(\) => null\)/);
  assert.match(home, /selectFreeNetworkPreview\(await freeNetworkPagePromise, context\.organizationName\)/);
  // Pro path and the main parallel batch are unchanged.
  assert.match(home, /networkEnabled && networkEntitled\s*\? searchNetwork\(\{ product: "tubes_pipes", page: 1 \}\)\.catch\(\(\) => null\)/);
  assert.match(home, /\[setup, commercial, activity, sector, procurement, pulse, marketplace, networkCatalog\] = await Promise\.all/);
});

test("HOME-NETPREVIEW1 radar shows companies instead of claiming the Network is unavailable", () => {
  assert.match(radar, /!networkEntitled && freeNetworkReadEnabled \?/);
  assert.match(radar, /data-testid="dashboard-free-network-preview"/);
  assert.match(radar, /"Vedi tutte le " \+ freeNetworkPreview\.total\.toLocaleString\("it-IT"\) \+ " aziende →"/);
  assert.match(radar, /l’elenco non è una selezione di fornitori per una RFQ/);
  // The old copy remains only when free read is switched off.
  assert.match(radar, /!networkEntitled && !freeNetworkReadEnabled \?[\s\S]*Il Network diventa disponibile/);
  assert.doesNotMatch(radar, /createClient\(|\.rpc\(|fetch\(|useEffect\(/);
});
