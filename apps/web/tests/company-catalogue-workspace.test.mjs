import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../lib/company-catalogue-workspace.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { parseCompanyCatalogueStatus } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

function item(overrides = {}) {
  return {
    catalog_id: "00000000-0000-4000-8000-000000026280",
    name: "catalogo-tubi.pdf", edition: "2026", format: "pdf", state: "pending_provenance",
    created_at: "2026-11-27T15:00:00.123456+00:00", uploaded_at: "2026-11-27T15:01:00Z",
    source_url: "https://producer.example.test/cataloghi/tubi.pdf", rights_declared_at: "2026-11-27T15:00:00Z",
    source_checked_at: null, withdrawn_at: null, rights_status: "not_verified",
    rights_verified_at: null, rights_expires_at: null, rights_revoked_at: null,
    ...overrides,
  };
}
function payload(items = [], overrides = {}) {
  return { contract: "netproducers-b3c2-v1", details_contract: "company-ux2d2-catalog-status-v1", limit: 20, eligible: true, items, ...overrides };
}

test("catalogues distinguish a confirmed empty list from unavailable or ineligible data", () => {
  assert.deepEqual(parseCompanyCatalogueStatus(payload()), payload());
  assert.deepEqual(parseCompanyCatalogueStatus(payload([], { eligible: false })), payload([], { eligible: false }));
  for (const value of [null, undefined, [], {}, { eligible: true, items: [] }, payload([], { eligible: "true" }), payload([], { items: null })]) {
    assert.equal(parseCompanyCatalogueStatus(value), null);
  }
  assert.equal(parseCompanyCatalogueStatus(payload([item()], { eligible: false })), null);
});

test("catalogue metadata requires the migrated contract rather than silently hiding source or rights", () => {
  for (const overrides of [{ contract: "unknown" }, { details_contract: undefined }, { details_contract: "old" }, { limit: 21 }]) {
    assert.equal(parseCompanyCatalogueStatus(payload([], overrides)), null);
  }
  const oldItem = item(); delete oldItem.rights_status;
  assert.equal(parseCompanyCatalogueStatus(payload([oldItem])), null);
});

test("catalogue status keeps verification and submission progress independent", () => {
  for (const rights_status of ["not_verified", "active", "expired", "revoked"]) {
    const row = item({
      state: "in_analysis", rights_status,
      rights_verified_at: rights_status === "not_verified" ? null : "2025-11-27T15:00:00Z",
      rights_expires_at: rights_status === "not_verified" ? null : "2026-11-27T15:00:00Z",
      rights_revoked_at: rights_status === "revoked" ? "2026-11-26T15:00:00Z" : null,
    });
    assert.equal(parseCompanyCatalogueStatus(payload([row])).items[0].rights_status, rights_status);
  }
  assert.equal(parseCompanyCatalogueStatus(payload([item({ state: "pending_provenance" })])).items[0].rights_status, "not_verified");
});

test("catalogue status rejects unknown states instead of labelling them verified", () => {
  for (const overrides of [{ state: "completed" }, { state: "published" }, { rights_status: "approved" }, { rights_status: true }]) {
    assert.equal(parseCompanyCatalogueStatus(payload([item(overrides)])), null);
  }
});

test("catalogue sources must be bounded HTTPS links without credentials or executable schemes", () => {
  for (const source_url of ["http://producer.example.test/a.pdf", "javascript:alert(1)", "data:text/plain,test", "https://name:password@producer.example.test/a.pdf", "https://producer.example.test/a.pdf#fragment", "https://producer.example.test/" + "a".repeat(1200), "not a URL"]) {
    assert.equal(parseCompanyCatalogueStatus(payload([item({ source_url })])), null, source_url.slice(0, 90));
  }
  const source_url = "https://producer.example.test/catalogue.pdf?edition=2026";
  assert.equal(parseCompanyCatalogueStatus(payload([item({ source_url })])).items[0].source_url, source_url);
});

test("catalogue dates support real PostgreSQL timestamps and preserve absent events", () => {
  const row = item({ created_at: "2024-02-29T23:59:59.123456+01:00", uploaded_at: null });
  assert.deepEqual(parseCompanyCatalogueStatus(payload([row])).items[0], row);
  for (const field of ["created_at", "rights_declared_at", "uploaded_at", "source_checked_at", "withdrawn_at", "rights_verified_at", "rights_expires_at", "rights_revoked_at"]) {
    for (const date of [undefined, "", "2026-02-30T12:00:00Z", "2026-11-27", "not a date"]) {
      assert.equal(parseCompanyCatalogueStatus(payload([item({ [field]: date })])), null, field + ": " + date);
    }
  }
});

test("catalogue active rights cannot hide a withdrawal, revocation or missing verification dates", () => {
  const active = item({ rights_status: "active", rights_verified_at: "2026-11-01T12:00:00Z", rights_expires_at: "2027-11-01T12:00:00Z" });
  assert.ok(parseCompanyCatalogueStatus(payload([active])));
  for (const overrides of [{ rights_verified_at: null }, { rights_expires_at: null }, { rights_revoked_at: "2026-11-27T12:00:00Z" }, { state: "withdrawn", withdrawn_at: "2026-11-27T12:00:00Z" }]) {
    assert.equal(parseCompanyCatalogueStatus(payload([{ ...active, ...overrides }])), null);
  }
  assert.equal(parseCompanyCatalogueStatus(payload([item({ state: "withdrawn" })])), null);
  assert.equal(parseCompanyCatalogueStatus(payload([item({ withdrawn_at: "2026-11-27T12:00:00Z" })])), null);
  assert.ok(parseCompanyCatalogueStatus(payload([item({ state: "withdrawn", withdrawn_at: "2026-11-27T12:00:00Z", rights_status: "not_verified" })])));
});

test("catalogue lists are limited to twenty unique documents and never drop malformed rows", () => {
  const rows = Array.from({ length: 20 }, (_, i) => item({ catalog_id: "00000000-0000-4000-8000-" + String(i).padStart(12, "0") }));
  assert.equal(parseCompanyCatalogueStatus(payload(rows)).items.length, 20);
  assert.equal(parseCompanyCatalogueStatus(payload([...rows, item()])), null);
  assert.equal(parseCompanyCatalogueStatus(payload([item(), item()])), null);
  assert.equal(parseCompanyCatalogueStatus(payload([rows[0], null])), null);
  assert.equal(parseCompanyCatalogueStatus(payload([rows[0], item({ catalog_id: "unknown" })])), null);
});

test("catalogue document metadata has real format, name and edition limits", () => {
  for (const overrides of [{ name: "" }, { name: "a".repeat(141) }, { edition: " " }, { edition: "a".repeat(81) }, { format: "xlsx" }, { format: null }]) {
    assert.equal(parseCompanyCatalogueStatus(payload([item(overrides)])), null);
  }
  assert.ok(parseCompanyCatalogueStatus(payload([item({ name: "a".repeat(140), edition: "a".repeat(80), format: "csv" })])));
});

test("catalogue parser exposes only the approved display metadata", () => {
  const row = Object.freeze(item({ object_path: "private-file", document_sha256: "internal-hash", verification_reference: "internal-reference", submitted_by: "private-user" }));
  const parsed = parseCompanyCatalogueStatus(Object.freeze(payload(Object.freeze([row]))));
  assert.deepEqual(parsed.items[0], item());
  assert.notEqual(parsed.items[0], row);
});
