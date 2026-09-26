import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/review/identities/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/review/identities/actions.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260926162021_p2_legacy_message_identity_recovery.sql", import.meta.url),
  "utf8",
);

test("P2.3 identity review surfaces deterministic legacy recovery coverage", () => {
  assert.match(page, /p2_rfq_attribution_recovery_status/);
  assert.match(page, /Legacy identity recovery/);
  assert.match(page, /header legacy recuperati/);
  assert.match(page, /RFQ senza Company/);
  assert.match(page, /RFQ da confermare/);
});

test("P2.3 UI states that weak identity evidence is never used for Company inference", () => {
  assert.match(page, /Dominio email, filename, subject e body non vengono usati per dedurre la Company/);
  assert.match(page, /email esatta/);
  assert.match(page, /La selezione è sempre manuale/);
});

test("P2.3 confirmation refreshes demand and re-engagement intelligence", () => {
  assert.match(actions, /revalidatePath\("\/commercial\/demand"\)/);
  assert.match(actions, /revalidatePath\("\/commercial\/reengagement"\)/);
  assert.match(actions, /revalidatePath\("\/commercial\/companies"\)/);
});

test("P2.3 migration uses materialize-then-finalize consensus", () => {
  assert.match(migration, /commercial_message_identity_recoveries/);
  assert.match(migration, /p2_recover_legacy_message_identity/);
  assert.match(migration, /p2_finalize_legacy_conversation_identity/);
  assert.match(migration, /multi_message_company_requires_consensus/);
  assert.match(migration, /materialize_then_finalize/);
  assert.match(migration, /email_domain_inference',false/);
  assert.match(migration, /filename_inference',false/);
});

test("P2.3 public recovery functions are not executable by anon", () => {
  assert.match(
    migration,
    /revoke all on function public\.p2_recover_legacy_message_identity[\s\S]*from public,anon/,
  );
  assert.match(
    migration,
    /revoke all on function public\.p2_finalize_legacy_conversation_identity[\s\S]*from public,anon/,
  );
});
