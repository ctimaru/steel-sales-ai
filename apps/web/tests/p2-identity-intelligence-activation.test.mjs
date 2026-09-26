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
const form = fs.readFileSync(
  new URL("../components/identity-confirm-form.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260926174500_p2_identity_confirmation_intelligence_activation.sql", import.meta.url),
  "utf8",
);

test("P2.4 identity review loads activation readiness alongside recovery queue", () => {
  assert.match(page, /p2_identity_activation_readiness/);
  assert.match(page, /P2\.4 · Intelligence activation/);
  assert.match(page, /Conversazioni da attivare/);
  assert.match(page, /RFQ da attribuire/);
});

test("P2.4 shows per-contact activation impact before human confirmation", () => {
  assert.match(page, /Impatto della conferma/);
  assert.match(page, /conversation_count/);
  assert.match(page, /unattributed_rfq_count/);
  assert.match(page, /La Company non viene proposta automaticamente/);
});

test("P2.4 confirmation result reports conversation and RFQ activation", () => {
  assert.match(actions, /activated_conversations/);
  assert.match(actions, /resolved_messages/);
  assert.match(actions, /linked_rfqs/);
  assert.match(actions, /conversazioni/);
  assert.match(form, /Conferma e attiva/);
});

test("P2.4 migration preserves human decision and conflict guards", () => {
  assert.match(migration, /human_confirmation_required',true/);
  assert.match(migration, /email_domain_inference',false/);
  assert.match(migration, /Identity activation conflicts with an existing Conversation Company/);
  assert.match(migration, /blocked_existing_business_company_conflict/);
  assert.match(migration, /conversation_linked_count/);
});

test("P2.4 public RPCs use invoker security and deny anon", () => {
  assert.match(
    migration,
    /p2_identity_activation_readiness[\s\S]*security invoker/,
  );
  assert.match(
    migration,
    /p2_reconcile_verified_identity_activation[\s\S]*security invoker/,
  );
  assert.match(
    migration,
    /revoke all on function public\.p2_identity_activation_readiness\(uuid,integer\)[\s\S]*from public,anon/,
  );
});
