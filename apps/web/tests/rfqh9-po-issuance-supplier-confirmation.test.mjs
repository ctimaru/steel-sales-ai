import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006152146_rfqh9_po_issuance_supplier_confirmation.sql", import.meta.url),
  "utf8",
);
const hardening = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006153101_rfqh9_exact_confirmation_hardening.sql", import.meta.url),
  "utf8",
);
const helper = fs.readFileSync(
  new URL("../lib/rfqh9-po.ts", import.meta.url),
  "utf8",
);
const buyerActions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/po-actions.ts", import.meta.url),
  "utf8",
);
const buyerPanel = fs.readFileSync(
  new URL("../components/rfqh9-purchase-order-panel.tsx", import.meta.url),
  "utf8",
);
const supplierActions = fs.readFileSync(
  new URL("../app/(public)/po/respond/[token]/actions.ts", import.meta.url),
  "utf8",
);
const supplierPage = fs.readFileSync(
  new URL("../app/(public)/po/respond/[token]/page.tsx", import.meta.url),
  "utf8",
);
const supplierPortal = fs.readFileSync(
  new URL("../components/rfqh9-supplier-po-portal.tsx", import.meta.url),
  "utf8",
);
const buyerPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);

test("RFQH9 versions every issued PO and freezes a cryptographic snapshot", () => {
  assert.match(migration, /create table if not exists public\.buyer_purchase_order_versions/);
  assert.match(migration, /unique\(po_draft_id,version_no\)/);
  assert.match(migration, /snapshot jsonb not null/);
  assert.match(migration, /snapshot_sha256 text not null/);
  assert.match(migration, /extensions\.digest\(v_snapshot::text,'sha256'\)/);
  assert.match(migration, /status='superseded'/);
});

test("RFQH9 freezes issued PO lines instead of mutating RFQH7 economics", () => {
  assert.match(migration, /create table if not exists public\.buyer_purchase_order_version_lines/);
  assert.match(migration, /source_po_line_id uuid not null/);
  assert.match(migration, /awarded_tonnes numeric/);
  assert.match(migration, /unit_eur_t numeric/);
  assert.match(migration, /unit_eur_m numeric/);
  assert.match(migration, /line_total_eur numeric/);
  assert.doesNotMatch(buyerActions, /awarded_tonnes|unit_eur_t|line_total_eur/);
});

test("RFQH9 allows buyer edits only on operational PO terms before issue or reissue", () => {
  assert.match(migration, /rfqh9_update_po_terms_impl/);
  assert.match(migration, /status not in\('draft','change_requested','supplier_rejected'\)/);
  assert.match(migration, /incoterm=/);
  assert.match(migration, /payment_terms=/);
  assert.match(migration, /delivery_date=/);
  assert.match(buyerPanel, /Prezzi e quantità sono congelati dall&apos;award/);
});

test("RFQH9 supplier capability is token-hash scoped and does not require an account", () => {
  assert.match(migration, /rfqh_secure\.rfqh9_supplier_portal_impl/);
  assert.match(migration, /where v\.token_hash=p_token_hash/);
  assert.match(migration, /grant execute on function public\.rfqh9_supplier_portal\(text\) to anon,authenticated/);
  assert.match(supplierPage, /rfqh9_supplier_portal/);
  assert.match(supplierActions, /rfqh9_supplier_decide/);
});

test("RFQH9 supports supplier confirm reject and change request with one response per version", () => {
  assert.match(migration, /decision in\('confirmed','rejected','change_requested'\)/);
  assert.match(migration, /po_version_id uuid not null unique/);
  assert.match(migration, /Supplier message is required for rejection or change request/);
  assert.match(supplierPortal, /Conferma ordine/);
  assert.match(supplierPortal, /Richiedi modifica/);
  assert.match(supplierPortal, /Rifiuta ordine/);
});

test("RFQH9 exact confirmation cannot silently change issued delivery terms", () => {
  assert.match(hardening, /Confirmed delivery date must match issued PO; request a change instead/);
  assert.match(hardening, /v_version\.delivery_date is distinct from p_confirmed_delivery_date/);
  assert.match(hardening, /v_decision='confirmed'/);
});

test("RFQH9 keeps prior versions available after a supplier change request", () => {
  assert.match(migration, /supplier_rejected','change_requested','superseded/);
  assert.match(migration, /select coalesce\(max\(v\.version_no\),0\)\+1/);
  assert.match(buyerPanel, /Storico versioni/);
  assert.match(buyerPanel, /Emetti nuova versione PO/);
});

test("RFQH9 buyer issuance sends a personal server-side email and retains fallback link", () => {
  assert.match(helper, /createHmac\("sha256", secret\(\)\)/);
  assert.match(helper, /rfqh9-po/);
  assert.match(buyerActions, /RESEND_API_KEY/);
  assert.match(buyerActions, /Idempotency-Key/);
  assert.match(buyerActions, /buildRfqh9SupplierUrl/);
  assert.match(buyerPanel, /Copia link supplier/);
  assert.doesNotMatch(buyerPanel, /RESEND_API_KEY|RFQ_INVITE_SECRET|PO_CONFIRMATION_SECRET/);
});

test("RFQH9 supplier document can be printed or saved as PDF", () => {
  assert.match(supplierPortal, /Stampa \/ Salva PDF/);
  assert.match(supplierPortal, /window\.print\(\)/);
  assert.match(supplierPortal, /Snapshot SHA-256/);
  assert.match(supplierPortal, /Purchase Order/);
});

test("RFQH9 direct issuance tables are owner-readable only through RLS", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.buyer_purchase_order_versions from anon,authenticated/);
  assert.match(migration, /grant select on public\.buyer_purchase_order_versions to authenticated/);
  assert.match(migration, /owner_user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /security invoker/);
});

test("RFQH9 is integrated after RFQH7 award in the buyer detail", () => {
  assert.match(buyerPage, /rfqh9_po_state/);
  assert.match(buyerPage, /createRfqh9PoSecurity/);
  assert.match(buyerPage, /Rfqh9PurchaseOrderPanel/);
  assert.match(buyerPage, />Ordine di acquisto</);
});
