import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const lookupService = fs.readFileSync(
  new URL("../lib/public-company-lookup.ts", import.meta.url),
  "utf8",
);
const lookupContract = fs.readFileSync(
  new URL("../lib/public-company-lookup-contract.ts", import.meta.url),
  "utf8",
);
const route = fs.readFileSync(
  new URL("../app/api/public/company-lookup/route.ts", import.meta.url),
  "utf8",
);
const publicClient = fs.readFileSync(
  new URL("../lib/supabase/public.ts", import.meta.url),
  "utf8",
);
const register = fs.readFileSync(
  new URL("../app/register/page.tsx", import.meta.url),
  "utf8",
);

test("HP2.2a public lookup uses the stateless publishable-key client", () => {
  assert.match(lookupService, /createPublicSupabaseClient/);
  assert.doesNotMatch(lookupService, /supabase\/server/);
  assert.match(publicClient, /persistSession: false/);
  assert.match(publicClient, /autoRefreshToken: false/);
});

test("HP2.2a public lookup contains route-safe recovery instead of throwing to root error", () => {
  assert.match(lookupService, /try \{/);
  assert.match(lookupService, /catch \{/);
  assert.match(lookupService, /return \{ status: "error", mode: null, items: \[\] \}/);
  assert.match(lookupService, /supabase\.rpc\("pa1_2_company_lookup"/);
  assert.match(route, /NextResponse\.json/);
  assert.match(route, /Cache-Control/);
});

test("HP2.2a keeps anonymous result projection minimal", () => {
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

test("HP2.2a guidance no longer competes with the official four-step journey", () => {
  assert.match(register, /Completa la richiesta/);
  assert.doesNotMatch(register, /\["01", "Cerca"/);
  assert.match(register, /<RegistrationJourney current=\{1\} compact \/>/);
});
