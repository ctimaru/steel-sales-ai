import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006113158_rfqh4_supplier_response_portal.sql", import.meta.url),
  "utf8",
);
const indexHardening = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006113947_rfqh4_quote_fk_index_hardening.sql", import.meta.url),
  "utf8",
);
const portalPage = fs.readFileSync(
  new URL("../app/(public)/rfq/respond/[token]/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(public)/rfq/respond/[token]/actions.ts", import.meta.url),
  "utf8",
);
const responseForm = fs.readFileSync(
  new URL("../components/rfq-supplier-response-form.tsx", import.meta.url),
  "utf8",
);
const buyerPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);
const uploadFunction = fs.readFileSync(
  new URL("../../../supabase/functions/rfqh4-offer-upload/index.ts", import.meta.url),
  "utf8",
);

test("RFQH4 persists versioned supplier quotes and line responses", () => {
  assert.match(migration, /create table if not exists public\.buyer_rfq_quotes/);
  assert.match(migration, /revision_no integer not null/);
  assert.match(migration, /status in\('draft','submitted','declined','superseded'\)/);
  assert.match(migration, /create table if not exists public\.buyer_rfq_quote_lines/);
  assert.match(migration, /response_status in\('quoted','not_available'\)/);
  assert.match(migration, /unique\(quote_id,rfq_line_id\)/);
});

test("RFQH4 normalizes €/t and €/m from the frozen kg/m", () => {
  assert.match(migration, /v_norm_m:=v_unit\*v_source\.weight_kg_m\/1000/);
  assert.match(migration, /v_norm_t:=v_unit\*1000\/v_source\.weight_kg_m/);
  assert.match(migration, /normalized_eur_t/);
  assert.match(migration, /normalized_eur_m/);
  assert.match(responseForm, /Equivalente/);
  assert.match(responseForm, /rawPrice \* weight \/ 1000/);
  assert.match(responseForm, /rawPrice \* 1000 \/ weight/);
});

test("RFQH4 supplier capability never exposes buyer target pricing", () => {
  const supplierSurface = portalPage + actions + responseForm;
  assert.doesNotMatch(
    supplierSurface,
    /target_eur_t|target_eur_m|target_total_eur|Target €\/t|Target €\/m/,
  );
  assert.match(portalPage, /Target buyer non condiviso/);
  assert.doesNotMatch(
    migration.match(/rfqh_secure\.rfqh4_get_portal_impl[\s\S]*?revoke all on function rfqh_secure\.rfqh4_get_portal_impl/)?.[0] ?? "",
    /target_eur_t|target_eur_m|target_total_eur/,
  );
});

test("RFQH4 guest mutations stay behind hashed invite capability wrappers", () => {
  assert.match(actions, /createHash\("sha256"\)/);
  assert.match(actions, /rfqh4_save_quote/);
  assert.match(actions, /rfqh4_submit_quote/);
  assert.match(actions, /rfqh4_decline/);
  assert.match(actions, /rfqh4_start_revision/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /rfqh_secure\.rfqh4_save_quote_impl/);
  assert.match(migration, /grant execute on function public\.rfqh4_save_quote/);
  assert.match(migration, /revoke all on public\.buyer_rfq_quotes from anon,authenticated/);
  assert.match(migration, /revoke all on public\.buyer_rfq_quote_lines from anon,authenticated/);
});

test("RFQH4 submission requires complete line disposition and at least one quote", () => {
  assert.match(migration, /Every RFQ line requires a response/);
  assert.match(migration, /Quote at least one RFQ line or decline the RFQ/);
  assert.match(migration, /Every quoted line requires a valid price/);
  assert.match(migration, /status='responded'/);
  assert.match(migration, /quote_submitted/);
});

test("RFQH4 revisions preserve prior submitted versions", () => {
  assert.match(migration, /status='superseded'/);
  assert.match(migration, /v_current\.revision_no\+1/);
  assert.match(migration, /quote_revision_started/);
  assert.match(responseForm, /Crea nuova revisione/);
});

test("RFQH4 supports structured commercial terms and decline", () => {
  for (const field of [
    "incoterm",
    "payment_terms",
    "validity_until",
    "lead_time_days",
    "delivery_date",
    "moq_tonnes",
  ]) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(responseForm, /Non posso quotare questa RFQ/);
  assert.match(migration, /quote_declined/);
});

test("RFQH4 attachments are private, size/type constrained and server uploaded", () => {
  assert.match(migration, /rfq-supplier-offers/);
  assert.match(migration, /10485760/);
  assert.match(migration, /application\/pdf/);
  assert.match(migration, /rfqh4_buyer_offer_attachment_select/);
  assert.match(uploadFunction, /SUPABASE_SECRET_KEYS/);
  assert.match(uploadFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(uploadFunction, /rfqh4_prepare_attachment/);
  assert.match(uploadFunction, /rfqh4_record_attachment/);
  assert.match(uploadFunction, /MAX_SIZE = 10 \* 1024 \* 1024/);
  assert.match(uploadFunction, /ALLOWED_ORIGINS/);
  assert.doesNotMatch(uploadFunction, /console\.log\(token/);
});

test("RFQH4 buyer sees latest response without prematurely implementing RFQH5 ranking", () => {
  assert.match(buyerPage, /buyer_rfq_quotes/);
  assert.match(buyerPage, /buyer_rfq_quote_lines/);
  assert.match(buyerPage, /Risposte fornitori/);
  assert.match(buyerPage, /createSignedUrl/);
  assert.match(buyerPage, /RFQH5 userà queste risposte/);
  assert.doesNotMatch(buyerPage, /miglior fornitore|auto-award|ranking score/i);
});


test("RFQH4 covers new quote foreign-key access paths", () => {
  assert.match(indexHardening, /buyer_rfq_quote_lines_rfq_line_idx/);
  assert.match(indexHardening, /buyer_rfq_quotes_organization_idx/);
  assert.match(indexHardening, /buyer_rfq_quotes_supplier_idx/);
});
