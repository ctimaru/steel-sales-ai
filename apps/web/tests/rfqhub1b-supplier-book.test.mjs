import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../lib/rfqhub-suppliers.ts");
const page = read("../app/(italian)/(workspace)/marketplace/suppliers/page.tsx");
const actions = read("../app/(italian)/(workspace)/marketplace/suppliers/actions.ts");
const form = read("../components/supplier-contact-form.tsx");
const migration = read("../../../supabase/migrations/20261119090000_rfqhub1b_supplier_contacts.sql");
const gate = read("../../../.github/workflows/p0-required-gate.yml");

const code = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const book = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const profile = (over) => ({ id: "p1", display_name: "Tubi Nord", email: "rfq@tubinord.example", preferred: false,
  saved_in_network: false, supplier_network_company_id: null, supplier_company_id: null,
  rfq_count: 1, response_rate_pct: "50.0", last_used_at: "2026-11-10T09:00:00Z", ...over });

test("RFQHUB1B merges active, saved and Commerciale data into one row per supplier", () => {
  const rows = book.buildSupplierBook({
    profiles: [
      profile({ id: "p1", supplier_network_company_id: "n1", saved_in_network: true, preferred: true }),
      profile({ id: "p2", display_name: "Tubi Nord (2)", supplier_network_company_id: "n1", rfq_count: 2, last_used_at: "2026-11-12T09:00:00Z" }),
      profile({ id: "p3", display_name: null, email: "solo@email.example", last_used_at: "2026-11-01T09:00:00Z" }),
    ],
    saved: [
      { network_company_id: "n1", name: "Tubi Nord S.p.A.", country_code: "IT", saved_at: "2026-10-01T09:00:00Z" },
      { network_company_id: "n2", name: "Lamiere Sud", country_code: "IT", saved_at: "2026-11-15T09:00:00Z" },
    ],
    companies: [{ id: "c1", name: "Tubi Nord", network_company_id: "n1" }],
    contacts: [
      { id: "k2", company_id: "c1", full_name: "Zeno Verdi", email: "z@tn.example", phone: null, role: null },
      { id: "k1", company_id: "c1", full_name: "Anna Rossi", email: "a@tn.example", phone: null, role: "Vendite" },
      { id: "k3", company_id: null, full_name: "Senza azienda", email: "x@x.example", phone: null, role: null },
    ],
  });
  assert.deepEqual(rows.map((r) => r.key), ["network:n1", "network:n2", "profile:p3"]);
  const tn = rows[0];
  assert.equal(tn.rfqCount, 3, "two profiles of the same supplier add up");
  assert.equal(tn.lastUsedAt, "2026-11-12T09:00:00Z");
  assert.ok(tn.active && tn.saved && tn.preferred);
  assert.equal(tn.companyId, "c1");
  assert.deepEqual(tn.contacts.map((c) => c.full_name), ["Anna Rossi", "Zeno Verdi"]);
  assert.equal(rows[1].active, false);
  assert.equal(rows[1].name, "Lamiere Sud");
  assert.equal(rows[2].name, "solo@email.example");
  assert.equal(book.supplierBookCanAddContact(rows[2]), false, "an e-mail-only supplier has no company to attach to");
  assert.equal(book.supplierBookCanAddContact(rows[1]), true);

  assert.deepEqual(book.supplierBookFilter(rows, "attivi").map((r) => r.key), ["network:n1", "profile:p3"]);
  assert.deepEqual(book.supplierBookFilter(rows, "salvati").map((r) => r.key), ["network:n1", "network:n2"]);
  assert.deepEqual(book.supplierBookFilter(rows, "attivi", "anna").map((r) => r.key), ["network:n1"], "search includes contacts");
});

test("RFQHUB1B views, URLs and error messages", () => {
  assert.equal(book.supplierBookView("salvati"), "salvati");
  assert.equal(book.supplierBookView("x"), "attivi");
  assert.equal(book.supplierBookHref("attivi"), "/rfq-hub/suppliers");
  assert.equal(book.supplierBookHref("salvati", "tubi"), "/rfq-hub/suppliers?vista=salvati&q=tubi");
  assert.equal(book.supplierContactError("email_in_use"), "Questa email è già un contatto di un altro fornitore.");
  assert.equal(book.supplierContactError("???"), "Salvataggio non riuscito. Riprova.");
});

test("RFQHUB1B page reads tenant-scoped data and lets only writers add contacts", () => {
  assert.match(page, /data-testid="supplier-book-list"/);
  assert.match(page, /data-testid="supplier-book-row"/);
  assert.match(page, /supabase\.rpc\("rfqh11_supplier_directory"/);
  assert.equal((page.match(/\.eq\("organization_id", organizationId\)/g) ?? []).length, 3);
  assert.match(page, /\.eq\("user_id", context\.userId\)/);
  assert.match(page, /canWrite && supplierBookCanAddContact\(supplier\)/);
  assert.match(page, /privateNoIndexRobots/);
  assert.doesNotMatch(page + actions + form, /service_role|createAdminClient|autoDispatch|sendEmail/);
  assert.match(actions, /if \(!canWriteWorkspace\(context\.role\)\)/);
  assert.match(actions, /supabase\.rpc\("rfqhub1b_save_supplier_contact"/);
  assert.match(actions, /p_organization_id: context\.organizationId/);
  assert.match(form, /router\.refresh\(\)/);
});

test("RFQHUB1B migration adds one link column and a write-member-only save function", () => {
  assert.match(migration, /add column if not exists network_company_id uuid null/);
  assert.match(migration, /companies_org_network_company_uq/);
  assert.match(migration, /where network_company_id is not null/);
  assert.match(migration, /public\.is_organization_member\(p_organization_id, true\)/);
  assert.match(migration, /'email_in_use'/);
  assert.match(migration, /revoke all on function public\.rfqhub1b_save_supplier_contact\(uuid, uuid, uuid, text, text, text, text\) from public, anon/);
  assert.doesNotMatch(migration, /drop table|delete from public\./i);
  assert.match(gate, /rfqhub1b_supplier_contacts\.sql/);
});
