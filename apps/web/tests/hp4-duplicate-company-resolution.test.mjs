import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261001113800_hp4_duplicate_company_resolution.sql",
    import.meta.url,
  ),
  "utf8",
);
const platformAdmin = fs.readFileSync(
  new URL("../lib/platform-admin.ts", import.meta.url),
  "utf8",
);
const registrationDetail = fs.readFileSync(
  new URL("../app/(platform)/platform/registrations/[id]/page.tsx", import.meta.url),
  "utf8",
);

test("HP4 canonicalizes legal identifiers and prevents formatting duplicates", () => {
  assert.match(migration, /hp4_normalize_identifier/);
  assert.match(migration, /network_companies_country_vat_canonical_uidx/);
  assert.match(migration, /network_companies_country_registration_canonical_uidx/);
  assert.match(migration, /regexp_replace\([\s\S]*?\[\^A-Z0-9\]/);
});

test("HP4 keeps shared domains informative instead of forcing an unsafe merge", () => {
  assert.match(
    migration,
    /\(cb\.vat_match or cb\.registration_match or cb\.legal_name_match\) as blocking_match/,
  );
  assert.match(migration, /else 'shared_domain'/);
  assert.match(
    migration,
    /where not cf\.blocking_match[\s\S]*?and cf\.domain_match/,
  );
  assert.match(migration, /'create_new_allowed', v_candidate_count = 0/);
});

test("HP4 exposes managed identity state and disables duplicate linking", () => {
  assert.match(migration, /active_link_organization_id/);
  assert.match(migration, /approved_claim_organization_id/);
  assert.match(migration, /as selectable/);
  assert.match(platformAdmin, /selectable: boolean;/);
  assert.match(platformAdmin, /possible_matches: RegistrationNetworkCandidate\[\];/);
});

test("HP4 Platform UI distinguishes blocking candidates from domain-only warnings", () => {
  assert.match(registrationDetail, /getRegistrationIdentityResolution/);
  assert.match(registrationDetail, /Possibili omonimie di dominio/);
  assert.match(registrationDetail, /candidate\.selectable/);
  assert.match(registrationDetail, /Profilo già gestito da un’altra Organization/);
  assert.match(registrationDetail, /Nessun match identitario bloccante rilevato/);
});
