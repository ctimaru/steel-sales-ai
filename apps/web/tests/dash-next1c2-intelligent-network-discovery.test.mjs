import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const model = read("../lib/dashboard-network-discovery.ts");
const dashboard = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const radar = read("../components/dashboard-discovery-feed.tsx");
const network = read("../lib/network.ts");

const exports = {};
vm.runInNewContext(ts.transpileModule(model, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { selectDashboardNetworkCompanies } = exports;

const uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const emptyPrefs = () => ({ product_interests: [], territory_interests: [] });
const company = (n, changes = {}) => ({
  id: uuid(n), legal_name: "Azienda " + n, trading_name: null,
  country_code: "IT", verification_status: "unverified", claimed_status: "unclaimed",
  website_url: null, website_domain: null, facility_countries: ["IT"],
  roles: [{ key: "producer", name: "Produttore", is_primary: true }],
  products: [{ key: "tubes_pipes", name: "Tubi e pipe", relationship_type: "produces" }],
  markets: [], capabilities: [],
  ...changes,
});

test("NEXT1C.2 ranks explicit published catalog facts and explains why a company appears", () => {
  const generic = company(1, { country_code: "DE", facility_countries: ["DE"] });
  const match = company(2, {
    roles: [{ key: "end_user", name: "Utilizzatore", is_primary: true }],
    verification_status: "verified",
    products: [
      { key: "tubes_pipes", name: "Tubi e pipe", relationship_type: "uses" },
      { key: "welded_tubes", name: "Tubi saldati", relationship_type: "uses" },
    ],
    capabilities: [{ key: "cutting", name: "Taglio laser" }],
  });
  const selected = Array.from(selectDashboardNetworkCompanies(
    [generic, match],
    "commerciante",
    { product_interests: ["welded_tubes", "steel_processing"], territory_interests: ["italy"] },
  ));
  assert.deepEqual(selected.map((x) => x.id), [uuid(2), uuid(1)]);
  assert.equal(selected[0].product, "Tubi saldati");
  assert.equal(selected[0].capability, "Taglio laser");
  assert.equal(selected[0].verifiedProfile, true);
  assert.ok(selected[0].reasons.some((r) => r.includes("Prodotto di interesse")));
  assert.ok(selected[0].reasons.some((r) => r.includes("Lavorazione a catalogo")));
  assert.equal(selected[0].reasons.length, 2);
  assert.equal(selected[1].verifiedProfile, false);
});

test("NEXT1C.2 rejects malformed and non-tube candidates, own company, and duplicate identities", () => {
  const own = company(10, { legal_name: "Acciai Uno", trading_name: "Acciai Uno" });
  const foreign = company(11, { products: [{ key: "plates", name: "Lamiera", relationship_type: "produces" }] });
  const valid = company(12);
  const result = Array.from(selectDashboardNetworkCompanies(
    [own, foreign, { ...company(13), id: "bad-id" }, valid, valid, company(14)],
    "unknown", emptyPrefs(), "  Acciai Uno  ", 9,
  ));
  assert.deepEqual(result.map((x) => x.id), [uuid(12), uuid(14)]);
  assert.ok(result.every((x) => x.name && x.product && x.id.length === 36));
});

test("NEXT1C.2 never converts generic tubes into an ungrounded welding or grade match", () => {
  const rows = Array.from(selectDashboardNetworkCompanies([company(5)], "unknown", {
    product_interests: ["welded_tubes", "seamless_tubes", "hollow_sections"],
    territory_interests: ["north_west"],
  }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].product, "Tubi e pipe");
  assert.deepEqual(Array.from(rows[0].reasons), []);
  assert.doesNotMatch(JSON.stringify(rows), /verificata per RFQ|EN 10219|Nord-Ovest|seamless|saldatura/);
});

test("NEXT1C.2 limits output to two, caps text, and projects no private fields", () => {
  const row = company(6, {
    legal_name: "A".repeat(400), products: [
      { key: "tubes_pipes", name: "Tubi ".repeat(60), relationship_type: "produces" },
    ],
    secret_email: "private@example.com", private_rfq: "do-not-show",
  });
  const result = Array.from(selectDashboardNetworkCompanies(
    [row, company(7), company(8), company(9)], "unknown", emptyPrefs(),
  ));
  assert.equal(result.length, 2);
  assert.ok(result[0].name.length <= 115);
  assert.ok(result[0].product.length <= 85);
  assert.doesNotMatch(JSON.stringify(result), /private@example.com|do-not-show|secret_email|private_rfq|contact/);
});

test("NEXT1C.2 fetch is entitlement-gated and bounded to published M6 Network with safe fallback", () => {
  assert.match(dashboard, /networkEnabled && networkEntitled\s*\? searchNetwork\(\{ product: "tubes_pipes", page: 1 \}\)\.catch\(\(\) => null\)/);
  assert.match(network, /m6_search_network/);
  assert.match(network, /p_limit: 18/);
  assert.match(dashboard, /networkEnabled && networkEntitled && networkCatalog/);
  assert.match(dashboard, /selectDashboardNetworkCompanies\(networkCatalog\.items, displaySector, pulse\.interests, context\.organizationName\)/);
  assert.doesNotMatch(dashboard + model + radar, /service_role|supabaseAdmin|buyer_rfq_suppliers|contact_email|buyer_email/);
  assert.match(radar, /networkEntitled \? \(/);
  assert.match(radar, /networkDiscoveryAvailable/);
  assert.match(radar, /appRoutes\.network\.company\(company\.id\)/);
  assert.match(radar, /catalogo non attestano l.idoneità tecnica per una RFQ/);
});

test("NEXT1C.2 makes no AI claims and leaves role/entitlement checks on the destination", () => {
  assert.match(radar, /Aziende da esplorare/);
  assert.match(radar, /Ricerca completa/);
  assert.match(radar, /Identità verificata/);
  assert.match(radar, /Scheda pubblicata/);
  assert.match(radar, /focus-visible:outline-2/);
  assert.match(model, /not an exhaustive supplier search/);
  assert.doesNotMatch(model + radar, /OpenAI|GPT-|AI-generated|Generato dall.AI|SUPER INTELLIGENCE ti consiglia/);
});
