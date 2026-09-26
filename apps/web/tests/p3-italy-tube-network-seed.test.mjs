import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/network/page.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260926215500_p3_italy_tube_network_seed.sql", import.meta.url),
  "utf8",
);

test("P3.1 exposes the four industrial company doors", () => {
  assert.match(page, /Produttori/);
  assert.match(page, /Commercianti/);
  assert.match(page, /Carpenterie & terzisti/);
  assert.match(page, /Utilizzatori/);
  assert.match(page, /producer/);
  assert.match(page, /trader_distributor/);
  assert.match(page, /processor_service_provider/);
  assert.match(page, /end_user/);
});

test("P3.1 keeps the tube beachhead explicit in category navigation", () => {
  assert.match(page, /query\.set\("product", "tubes_pipes"\)/);
  assert.match(page, /query\.set\("country", "IT"\)/);
  assert.match(page, /Italia · Tubes & Pipes/);
});

test("P3.1 surfaces unclaimed profiles as claimable without calling them verified", () => {
  assert.match(page, /company\.claimed_status === "unclaimed"/);
  assert.match(page, /Profilo rivendicabile/);
  assert.match(migration, /'published','unclaimed','unverified'/);
});

test("P3.1 seed contains real producer, distributor and processor roles", () => {
  assert.match(migration, /Acciaitubi S\.p\.A\. a socio unico/);
  assert.match(migration, /Generaltubi S\.p\.A\./);
  assert.match(migration, /Morandi S\.p\.A\./);
  assert.match(migration, /Copromet S\.r\.l\./);
  assert.match(migration, /ILT PROCESS TUBE S\.r\.l\./);
  assert.match(migration, /p3-1-italy-tube-public-web-2026-09-26/);
});
