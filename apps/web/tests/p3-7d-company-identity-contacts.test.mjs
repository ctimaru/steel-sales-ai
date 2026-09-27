import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260927224500_p3_7d_company_identity_public_contacts.sql", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const manage = fs.readFileSync(
  new URL("../app/(workspace)/network/manage/page.tsx", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const network = fs.readFileSync(
  new URL("../lib/network.ts", import.meta.url),
  "utf8",
);

test("P3.7D creates isolated governed company media storage", () => {
  assert.match(migration, /network-company-media/);
  assert.match(migration, /2097152/);
  assert.match(migration, /image\/png/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /image\/webp/);
  assert.doesNotMatch(migration, /image\/svg\+xml/);
  assert.match(migration, /p3_7d_can_manage_company_media_path/);
  assert.match(migration, /p3_7d_company_media_insert/);
  assert.match(migration, /p3_7d_company_media_update/);
  assert.match(migration, /p3_7d_company_media_delete/);
});

test("P3.7D governs logo and public-contact mutations with provenance and audit", () => {
  for (const rpc of [
    "p3_7d_set_logo_path",
    "p3_7d_upsert_contact",
    "p3_7d_archive_contact",
    "p3_7d_managed_identity_contacts",
    "p3_7d_public_identity_contacts",
  ]) {
    assert.match(migration, new RegExp(rpc));
  }

  assert.match(migration, /managed_profile:p3\.7d/);
  assert.match(migration, /company_declared/);
  assert.match(migration, /company_managed/);
  assert.match(migration, /platform or crawler contact cannot be overwritten directly/);
  assert.match(migration, /verified public contact requires Platform review/);
  assert.match(migration, /p3_7_record_profile_event_impl/);
});

test("P3.7D Company Profile Manager exposes logo and public-contact management", () => {
  assert.match(manage, /Company Profile Manager · P3\.7D/);
  assert.match(manage, /Logo aziendale/);
  assert.match(manage, /Contatti pubblici/);
  assert.match(manage, /Commercial Memory restano completamente separati/);
  assert.match(manage, /uploadManagedCompanyLogo/);
  assert.match(manage, /upsertManagedPublicContact/);
  assert.match(manage, /archiveManagedPublicContact/);

  assert.match(actions, /network-company-media/);
  assert.match(actions, /image\/png/);
  assert.match(actions, /image\/jpeg/);
  assert.match(actions, /image\/webp/);
  assert.doesNotMatch(actions, /image\/svg\+xml/);
  assert.match(actions, /COMPANY_LOGO_MAX_BYTES = 2 \* 1024 \* 1024/);
});

test("P3.7D public profile consumes real logo and safe public contact trust", () => {
  assert.match(network, /getNetworkCompanyLogoUrl/);
  assert.match(network, /p3_7d_public_identity_contacts/);
  assert.match(profile, /logoUrl/);
  assert.match(profile, /Logo /);
  assert.match(profile, /contact\.provenance_kind/);
  assert.match(profile, /contact\.verification_status/);
  assert.match(profile, /Contatti pubblici/);
});
