import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../lib/company-inventory-workspace.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
).outputText;
const {
  companyInventoryInput, filterCompanyInventory, inventoryUnitLabel, inventoryUpdatedLabel,
  normalizeCompanyInventoryRows, parseManagedCompanyInventory, summarizeCompanyInventory,
} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const company = "00000000-0000-4000-8000-000000026270";
const otherCompany = "00000000-0000-4000-8000-000000026271";
const itemId = "00000000-0000-4000-8000-000000026272";

function item(overrides = {}) {
  return {
    id: itemId, company_id: company, kind: "stock", product_name: "Tubi strutturali saldati",
    standard: "EN 10219", grade: "S355J2H", dimensions: "120 × 80 × 4 mm", quantity: 12.5,
    unit: "t", location: "Forlì", available_on: null, updated_at: "2026-11-27T11:00:00Z",
    provenance: "company_declared", publication_status: "draft", ...overrides,
  };
}

function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    network_company_id: company, item_id: "", kind: "stock", product_name: "Tubi strutturali saldati",
    standard: "EN 10219", grade: "S355J2H", dimensions: "120 × 80 × 4 mm", quantity: "12.5",
    unit: "t", location: "Forlì", available_on: "", intent: "draft", ...overrides,
  })) data.set(key, value);
  return data;
}

test("filters combine words, kind and explicit status across the available industrial fields", () => {
  const matching = item({ kind: "incoming", publication_status: "published", available_on: "2026-12-01" });
  const second = item({ id: otherCompany, kind: "incoming", publication_status: "draft" });
  const third = item({ id: company, kind: "incoming", publication_status: "published", location: "Milano" });
  const items = Object.freeze([Object.freeze(matching), Object.freeze(second), Object.freeze(third)]);
  assert.deepEqual(filterCompanyInventory(items, {
    query: "  FORLI s355  10219  120  ", kind: "incoming", visibility: "published",
  }), [matching]);
  assert.deepEqual(filterCompanyInventory(items, { query: "saldati", kind: "all", visibility: "draft" }), [second]);
  assert.deepEqual(filterCompanyInventory(items, { query: "", kind: "stock", visibility: "all" }), []);
  assert.deepEqual(filterCompanyInventory(items, { query: "inesistente", kind: "all", visibility: "all" }), []);
  assert.deepEqual(filterCompanyInventory(items, { query: " ", kind: "all", visibility: "all" }), items);
  assert.equal(items[0], matching);
});

test("summary counts records with mixed units without inferring a quantity total or unknown visibility", () => {
  const items = [
    item({ quantity: 1, unit: "t" }),
    item({ quantity: 1000, unit: "kg", publication_status: "published" }),
    item({ kind: "incoming", unit: "m", quantity: 80, publication_status: "published" }),
    item({ kind: "production", unit: "bars", quantity: 50, publication_status: undefined }),
  ];
  assert.deepEqual(summarizeCompanyInventory(items), {
    total: 4, stock: 2, incoming: 1, production: 1, draft: 1, published: 2,
  });
  assert.deepEqual(summarizeCompanyInventory([]), {
    total: 0, stock: 0, incoming: 0, production: 0, draft: 0, published: 0,
  });
  assert.equal(filterCompanyInventory(items, { query: "", kind: "all", visibility: "published" }).length, 2);
});

test("unit labels preserve the five independent measurement units", () => {
  assert.deepEqual(["t", "kg", "m", "bars", "pcs"].map(inventoryUnitLabel), ["t", "kg", "m", "barre", "pz"]);
});

test("updated labels use the Italian calendar in Rome and reject malformed timestamps", () => {
  assert.equal(inventoryUpdatedLabel("2026-11-27T11:00:00Z"), "27 nov 2026");
  assert.equal(inventoryUpdatedLabel("2026-11-27T23:30:00.123456+00:00"), "28 nov 2026");
  assert.equal(inventoryUpdatedLabel("2024-02-29T12:00:00Z"), "29 feb 2024");
  for (const invalid of [
    "", "not a date", "2026-11-27", "2026-11-27T12:00:00", "2026-02-29T12:00:00Z",
    "2026-02-30T12:00:00Z", "2026-13-01T12:00:00Z", "2026-11-27T24:00:00Z",
    "2026-11-27T12:60:00Z", "2026-11-27T12:00:00+24:00", "0000-01-01T00:00:00Z",
  ]) assert.equal(inventoryUpdatedLabel(invalid), null, invalid);
});

test("input trims declarations and accepts decimal commas without accepting client authority fields", () => {
  const parsed = companyInventoryInput(form({
    product_name: "  Tubi saldati  ", quantity: "12,125", standard: " ", location: "  Forlì  ",
    organization_id: otherCompany, provenance: "ai_generated", published_at: "2020-01-01",
  }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.input, {
    companyId: company, itemId: null, kind: "stock", productName: "Tubi saldati", standard: null,
    grade: "S355J2H", dimensions: "120 × 80 × 4 mm", quantity: 12.125, unit: "t", location: "Forlì",
    availableOn: null, publicationStatus: "draft",
  });
  const legacyForm = form(); legacyForm.delete("intent");
  assert.equal(companyInventoryInput(legacyForm).input.publicationStatus, "draft");
});

test("quantity validation preserves numeric(14,3) precision and limits instead of rounding", () => {
  for (const [raw, value] of [
    ["0.001", 0.001], [",125", 0.125], ["1000000000", 1000000000], ["999999999.999", 999999999.999],
    ["12.000", 12], [" 12,50 ", 12.5],
  ]) {
    const parsed = companyInventoryInput(form({ quantity: raw }));
    assert.equal(parsed.ok, true, raw);
    assert.equal(parsed.input.quantity, value, raw);
  }
  for (const quantity of [
    "", "0", "-1", "1000000000.001", "0.0001", "1.2345", "1.0000", "1e3", "NaN", "Infinity",
    "1,234.56", "1.234,56", "1 000", "0x10", "12,",
  ]) {
    const parsed = companyInventoryInput(form({ quantity }));
    assert.equal(parsed.ok, false, quantity);
    assert.match(parsed.message, /quantità/);
  }
});

test("publication requires real planned dates while stock and drafts retain their distinct semantics", () => {
  for (const kind of ["incoming", "production"]) {
    for (const available_on of ["2024-02-29", "2000-02-29", "2026-04-30", "2020-01-01"]) {
      const parsed = companyInventoryInput(form({ kind, intent: "published", available_on }));
      assert.equal(parsed.ok, true, available_on);
      assert.equal(parsed.input.availableOn, available_on);
    }
    for (const available_on of ["", "2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-01-00", "2026-1-01", "0000-01-01"]) {
      assert.equal(companyInventoryInput(form({ kind, intent: "published", available_on })).ok, false, available_on);
    }
    assert.equal(companyInventoryInput(form({ kind, intent: "draft" })).input.availableOn, null);
    assert.equal(companyInventoryInput(form({ kind, intent: "draft", available_on: "2026-02-30" })).ok, false);
  }
  const stock = companyInventoryInput(form({ kind: "stock", intent: "published", available_on: "not a date" }));
  assert.equal(stock.ok, true);
  assert.equal(stock.input.availableOn, null);
});

test("input rejects invalid identity, unsupported enums and archival without an existing item", () => {
  for (const overrides of [
    { network_company_id: "" }, { network_company_id: "other-company" }, { item_id: "invalid" },
    { intent: "public" }, { intent: "archived" }, { kind: "forecast" }, { unit: "tonnes" },
  ]) assert.equal(companyInventoryInput(form(overrides)).ok, false, JSON.stringify(overrides));
  const archived = companyInventoryInput(form({ intent: "archived", item_id: itemId }));
  assert.equal(archived.ok, true);
  assert.equal(archived.input.itemId, itemId);
  assert.equal(archived.input.publicationStatus, "archived");
});

test("input enforces field limits and rejects file or duplicate values", () => {
  for (const [field, max] of [["product_name", 180], ["standard", 90], ["grade", 90], ["dimensions", 160], ["location", 180]]) {
    assert.equal(companyInventoryInput(form({ [field]: "a".repeat(max) })).ok, true, field);
    assert.equal(companyInventoryInput(form({ [field]: "a".repeat(max + 1) })).ok, false, field);
  }
  for (const product_name of ["", " ", "a"]) assert.equal(companyInventoryInput(form({ product_name })).ok, false);
  const duplicate = form(); duplicate.append("intent", "published");
  assert.equal(companyInventoryInput(duplicate).ok, false);
  const file = form(); file.set("product_name", new Blob(["Tubi"]), "product.txt");
  assert.equal(companyInventoryInput(file).ok, false);
});

test("managed rows require explicit draft or published status and preserve declared unit and quantity", () => {
  const rows = [
    item(), item({ publication_status: "published", quantity: "7.125", unit: "bars" }),
    item({ publication_status: undefined }), item({ publication_status: null }),
    item({ publication_status: "archived" }), item({ publication_status: "unknown" }),
  ];
  const parsed = normalizeCompanyInventoryRows(rows, "managed");
  assert.deepEqual(parsed.map((row) => row.publication_status), ["draft", "published"]);
  assert.equal(parsed[1].quantity, 7.125);
  assert.equal(parsed[1].unit, "bars");
  assert.equal(parsed[0].provenance, "company_declared");
});

test("public normalizer accepts the established omitted status but never an explicit private state", () => {
  const legacyPublic = item(); delete legacyPublic.publication_status;
  const parsed = normalizeCompanyInventoryRows([
    legacyPublic, item({ publication_status: "published" }), item(),
    item({ publication_status: null }), item({ publication_status: "archived" }),
  ], "public");
  assert.equal(parsed.length, 2);
  assert.equal(parsed.every((row) => row.publication_status === "published"), true);
  assert.equal(legacyPublic.publication_status, undefined);
});

test("row normalization rejects malformed or inferred inventory without coercing booleans and objects", () => {
  for (const change of [
    { id: "invalid" }, { company_id: "invalid" }, { product_name: null }, { provenance: "ai_generated" },
    { kind: "forecast" }, { unit: "tonnes" }, { updated_at: null },
    ...[0, -1, 1e9 + 1, Infinity, NaN, true, [], [1], {}, null, "", "1.2345"].map((quantity) => ({ quantity })),
  ]) assert.deepEqual(normalizeCompanyInventoryRows([item(change)], "managed"), [], JSON.stringify(change));
  for (const value of [null, {}, "[]", [null, false, [], "row"]]) assert.deepEqual(normalizeCompanyInventoryRows(value, "managed"), []);
});

test("managed parser distinguishes a genuinely empty inventory from an unavailable or mixed-company response", () => {
  assert.deepEqual(parseManagedCompanyInventory([], company), { items: [], ready: true });
  for (const data of [null, {}, "[]", [item(), item({ publication_status: undefined })], [item({ company_id: otherCompany })]]) {
    assert.deepEqual(parseManagedCompanyInventory(data, company), { items: [], ready: false });
  }
  assert.deepEqual(parseManagedCompanyInventory([item()], company), { items: [item()], ready: true });
});

test("managed inventory retains its 100-record limit and source order without inventing aggregate totals", () => {
  const rows = Array.from({ length: 103 }, (_, i) => item({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, quantity: i + 1,
  }));
  const parsed = parseManagedCompanyInventory(rows, company);
  assert.equal(parsed.ready, true);
  assert.equal(parsed.items.length, 100);
  assert.deepEqual(parsed.items.map((row) => row.id), rows.slice(0, 100).map((row) => row.id));
  assert.deepEqual(summarizeCompanyInventory(parsed.items), {
    total: 100, stock: 100, incoming: 0, production: 0, draft: 100, published: 0,
  });
});

test("managed reader contains API and transport failures without confusing them with a valid empty inventory", async () => {
  const source = ts.transpileModule(
    readFileSync(new URL("../lib/network-stock.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  let response = { data: [], error: null };
  let rpcThrows = false;
  let clientThrows = false;
  const calls = [];
  const mocks = {
    "server-only": {},
    "@/lib/company-inventory-workspace": { normalizeCompanyInventoryRows, parseManagedCompanyInventory },
    "@/lib/supabase/server": { createClient: async () => {
      if (clientThrows) throw new Error("Client unavailable");
      return { rpc: async (name, args) => {
        calls.push({ name, args });
        if (rpcThrows) throw new Error("Transport unavailable");
        return response;
      } };
    } },
  };
  const reader = new SourceTextModule(source);
  await reader.link((name) => {
    assert.ok(Object.hasOwn(mocks, name), "Unexpected reader dependency: " + name);
    return new SyntheticModule(Object.keys(mocks[name]), function () {
      for (const [key, value] of Object.entries(mocks[name])) this.setExport(key, value);
    });
  });
  await reader.evaluate();
  const load = () => reader.namespace.getManagedNetworkInventory("workspace-org", company);
  assert.deepEqual(await load(), { items: [], ready: true });
  assert.deepEqual(calls.pop(), {
    name: "netprofile_ux1b_manage", args: { p_organization_id: "workspace-org", p_company_id: company },
  });
  for (const error of [{ code: "PGRST202" }, { code: "42501" }, { code: "503", message: "Service unavailable" }]) {
    response = { data: [item()], error };
    assert.deepEqual(await load(), { items: [], ready: false });
  }
  rpcThrows = true;
  assert.deepEqual(await load(), { items: [], ready: false });
  rpcThrows = false;
  clientThrows = true;
  assert.deepEqual(await load(), { items: [], ready: false });
  clientThrows = false;
  response = { data: [item()], error: null };
  assert.deepEqual(await load(), { items: [item()], ready: true });
});
