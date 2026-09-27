import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const network = fs.readFileSync(
  new URL("../lib/network.ts", import.meta.url),
  "utf8",
);
const boundary = fs.readFileSync(
  new URL("../../../supabase/migrations/20260927222000_p3_7c_provenance_boundary.sql", import.meta.url),
  "utf8",
);

test("P3.7C consumes a dedicated safe public profile read model", () => {
  assert.match(network, /p3_7c_public_company_profile/);
  assert.match(network, /PublicProfileProvenanceKind/);
  assert.match(network, /verified_certifications/);
  assert.match(network, /validity_state/);
  assert.match(boundary, /private\.p3_7c_public_company_profile_impl/);
  assert.match(boundary, /security definer/);
  assert.match(boundary, /security invoker/);
  assert.match(boundary, /revoke all on function public\.p3_7c_public_company_profile\(uuid\)\s*from public,anon/);
});

test("P3.7C composes trust, provenance and industrial sections on the public profile", () => {
  assert.match(page, /Steel Industry Network/);
  assert.match(page, /Profilo rivendicato/);
  assert.match(page, /Azienda verificata/);
  assert.match(page, /Ruolo nella filiera/);
  assert.match(page, /Prodotti e disponibilità industriale/);
  assert.match(page, /Sedi e capability/);
  assert.match(page, /Mercati serviti/);
  assert.match(page, /Certificazioni/);
  assert.match(page, /Dichiarato dall'azienda/);
  assert.match(page, /La completezza indica solo la presenza delle sezioni del profilo/);
});

test("P3.7C keeps the unified light blue design and readable selected actions", () => {
  assert.match(page, /bg-\[#2f6fed\]/);
  assert.match(page, /text-white/);
  assert.match(page, /bg-\[#f6f9ff\]/);
  assert.doesNotMatch(page, /bg-\[#1b4c5d\]/);
  assert.doesNotMatch(page, /text-\[#1b4c5d\]/);
});
