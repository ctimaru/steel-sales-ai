import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260928091500_p3_7f_real_profile_validation.sql", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);

test("P3.7F populates three representative real profiles without changing trust state", () => {
  for (const companyId of [
    "51100000-0000-5000-8000-000000000001",
    "51100000-0000-5000-8000-000000000005",
    "51100000-0000-5000-8000-000000000006",
  ]) {
    assert.match(migration, new RegExp(companyId));
  }

  assert.match(migration, /Acciaitubi/);
  assert.match(migration, /Morandi Steel/);
  assert.match(migration, /COPROMET/);
  assert.match(migration, /'public_web'/);
  assert.match(migration, /'platform_curated'/);
  assert.match(migration, /'unverified'/);
  assert.doesNotMatch(migration, /claimed_status='claimed'/);
  assert.doesNotMatch(migration, /verification_status='verified'/);
});

test("P3.7F gives the profiles commercially useful industrial depth", () => {
  assert.match(migration, /EN 10217-1/);
  assert.match(migration, /P235TR1/);
  assert.match(migration, /EN 10219/);
  assert.match(migration, /EN 10210/);
  assert.match(migration, /S355J2H/);
  assert.match(migration, /stockholding/);
  assert.match(migration, /cut_to_length/);
  assert.match(migration, /laser_cutting/);
  assert.match(migration, /iso_9001/);
  assert.match(migration, /iso_14001/);
  assert.match(migration, /iso_45001/);
  assert.match(migration, /en_1090/);
});

test("P3.7F moves buyer-relevant information above governance metrics", () => {
  assert.match(profile, /Commercial snapshot/);
  assert.match(profile, /Quello che serve sapere a colpo d'occhio/);
  assert.match(profile, /Norme e materiali/);
  assert.match(profile, /Servizi e mercati/);
  assert.match(profile, /Technical scope/);

  const products = profile.indexOf('eyebrow="Products"');
  const positioning = profile.indexOf('eyebrow="Industrial positioning"');
  assert.ok(products >= 0 && positioning >= 0 && products < positioning);
});

test("P3.7F groups repeated product relations into one commercial product card", () => {
  assert.match(profile, /productGroupMap/);
  assert.match(profile, /Array\.from\(productGroupMap\.values\(\)\)/);
  assert.match(profile, /product\.relationships\.map/);
  assert.match(profile, /famiglie · \{profile\.products\.length\} relazioni commerciali/);
});

test("P3.7F keeps public-source, company-declared and verified evidence distinct", () => {
  assert.match(profile, /Mercati e applicazioni/);
  assert.match(profile, /Certificazioni pubblicate/);
  assert.match(profile, /Lo scope tecnico può derivare da fonti pubbliche/);
  assert.match(profile, /ProvenanceBadge/);
  assert.match(profile, /VerificationBadge/);
  assert.doesNotMatch(
    profile,
    /Settori applicativi e mercati nei quali l'azienda dichiara di operare/,
  );
});
