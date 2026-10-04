import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/public-company-lookup-actions.ts", import.meta.url),
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
  assert.match(actions, /createPublicSupabaseClient/);
  assert.doesNotMatch(actions, /supabase\/server/);
  assert.match(publicClient, /persistSession: false/);
  assert.match(publicClient, /autoRefreshToken: false/);
});

test("HP2.2a public lookup contains route-safe recovery instead of throwing to root error", () => {
  assert.match(actions, /try \{/);
  assert.match(actions, /catch \{/);
  assert.match(actions, /return \{ status: "error", mode: null, items: \[\] \}/);
  assert.match(actions, /supabase\.rpc\("pa1_2_company_lookup"/);
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
    assert.match(actions, new RegExp(field));
  }

  for (const forbidden of [
    "products",
    "capabilities",
    "markets",
    "contacts",
    "website_url",
    "description",
  ]) {
    assert.doesNotMatch(actions, new RegExp(forbidden));
  }
});

test("HP2.2a guidance no longer competes with the official four-step journey", () => {
  assert.match(register, /Completa la richiesta/);
  assert.doesNotMatch(register, /\["01", "Cerca"/);
  assert.match(register, /<RegistrationJourney current=\{1\} compact \/>/);
});
