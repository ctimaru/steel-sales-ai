import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const lookup = fs.readFileSync(
  new URL("../components/public-company-lookup.tsx", import.meta.url),
  "utf8",
);
const lookupService = fs.readFileSync(
  new URL("../lib/public-company-lookup.ts", import.meta.url),
  "utf8",
);
const lookupContract = fs.readFileSync(
  new URL("../lib/public-company-lookup-contract.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261003163500_pa1_2_public_company_lookup.sql", import.meta.url),
  "utf8",
);

test("PA1.2 embeds real public lookup by company name or VAT", () => {
  assert.match(home, /<PublicCompanyLookup \/>/);
  assert.match(home, /Cercala per nome o Partita IVA/);
  assert.match(lookup, /name="company_query"/);
  assert.match(lookup, /Ragione sociale o Partita IVA/);
  assert.match(lookupService, /supabase\.rpc\("pa1_2_company_lookup"/);
});

test("PA1.2 keeps the rich Network private and premium", () => {
  assert.match(home, /Privato · Premium/);
  assert.match(home, /directory ricca, filtri avanzati, prodotti,[\s\S]*capability, mercati/i);
  assert.match(lookup, /Il Network completo non è pubblico/);
  assert.doesNotMatch(home, /href="\/network"/);
  assert.doesNotMatch(lookup, /href="\/network"/);
});

test("PA1.2 public result projection stays minimal", () => {
  for (const field of [
    "legal_name",
    "trading_name",
    "country_code",
    "vat_hint",
    "claim_state",
    "claim_ref",
  ]) {
    assert.match(lookupContract, new RegExp(field));
  }

  for (const forbidden of [
    "products",
    "capabilities",
    "markets",
    "contacts",
    "website_url",
    "description",
  ]) {
    assert.doesNotMatch(lookupContract, new RegExp(forbidden));
  }
});

test("PA1.2 limits anonymous search and does not create a public directory", () => {
  assert.match(migration, /limit 5/);
  assert.match(migration, /limit 1/);
  assert.match(migration, /char_length\(v_raw\)<3/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /public_lookup_private\.pa1_2_company_lookup_impl/);
  assert.doesNotMatch(migration, /grant select on (table )?public\.network_companies to anon/i);
});

test("PA1.2 maps lookup state into the governed PA1.4 handoff without pretending claim is complete", () => {
  assert.match(lookup, /Rivendica questa azienda/);
  assert.match(lookup, /Azienda non trovata/);
  assert.match(lookup, /Claim in verifica/);
  assert.match(lookup, /Già rivendicata/);
  assert.match(lookup, /\/register\?claim_ref=/);
  assert.match(lookup, /\/login\?next=/);
  assert.doesNotMatch(lookup, /\/network\/.*\/claim/);
});
