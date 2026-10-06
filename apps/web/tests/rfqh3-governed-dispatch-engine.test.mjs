import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006103754_rfqh3_governed_dispatch_engine.sql", import.meta.url),
  "utf8",
);
const capabilityHardening = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006104559_rfqh3_capability_schema_hardening.sql", import.meta.url),
  "utf8",
);
const reminderMigration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006111155_rfqh3_reminder_message_ledger.sql", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/actions.ts", import.meta.url),
  "utf8",
);
const dispatchLib = fs.readFileSync(
  new URL("../lib/rfqh3-dispatch.ts", import.meta.url),
  "utf8",
);
const dispatchPanel = fs.readFileSync(
  new URL("../components/rfq-dispatch-panel.tsx", import.meta.url),
  "utf8",
);
const invitePage = fs.readFileSync(
  new URL("../app/(public)/rfq/respond/[token]/page.tsx", import.meta.url),
  "utf8",
);
const webhook = fs.readFileSync(
  new URL("../app/api/webhooks/resend/route.ts", import.meta.url),
  "utf8",
);

test("RFQH3 creates one durable dispatch ledger row per supplier", () => {
  assert.match(migration, /create table if not exists public\.buyer_rfq_dispatches/);
  assert.match(migration, /unique\(supplier_id\)/);
  assert.match(migration, /unique\(token_hash\)/);
  assert.match(migration, /unique\(idempotency_key\)/);
  assert.match(migration, /unique\(provider_message_id\)/);
  assert.match(migration, /owner_user_id=\(select auth\.uid\(\)\)/);
});

test("RFQH3 launch is atomic, rate limited and suppression aware", () => {
  assert.match(migration, /rfqh3_launch_campaign_impl/);
  assert.match(migration, /Dispatch set must match all RFQ suppliers/);
  assert.match(migration, /Hourly RFQ launch limit reached/);
  assert.match(migration, /Daily supplier invite limit reached/);
  assert.match(migration, /buyer_rfq_email_suppressions/);
  assert.match(migration, /campaign_launched/);
});

test("RFQH3 sends one email per supplier with deterministic idempotency", () => {
  assert.match(actions, /for \(const dispatch of dispatches\)/);
  assert.match(actions, /to: \[input\.recipient\]/);
  assert.match(actions, /"Idempotency-Key": input\.idempotencyKey/);
  assert.match(dispatchLib, /createHmac\("sha256", secret\)/);
  assert.match(dispatchLib, /attemptVersion/);
});

test("RFQH3 keeps buyer target prices private from supplier email and landing", () => {
  assert.doesNotMatch(dispatchLib, /targetEurT|targetEurM|target_eur_t|target_eur_m/);
  assert.match(dispatchLib, /Il target economico del buyer è interno/);
  assert.doesNotMatch(invitePage, /target_eur_t|target_eur_m/);
  assert.match(invitePage, /Target buyer non condiviso/);
});

test("RFQH3 webhook verifies raw Svix signature before database ingestion", () => {
  assert.match(webhook, /await request\.text\(\)/);
  assert.match(webhook, /svix-id/);
  assert.match(webhook, /svix-timestamp/);
  assert.match(webhook, /svix-signature/);
  assert.match(webhook, /timingSafeEqual/);
  assert.match(webhook, /rfqh3_ingest_resend_event/);
  assert.match(migration, /provider_event_id text not null unique/);
});

test("RFQH3 supports delivery, bounce, complaint, link-open tracking and retry", () => {
  assert.match(migration, /email\.delivered/);
  assert.match(migration, /email\.bounced/);
  assert.match(migration, /email\.complained/);
  assert.match(migration, /invite_opened/);
  assert.match(migration, /dispatch_retry_queued/);
  assert.match(actions, /retryFailedBuyerRfq/);
  assert.match(dispatchPanel, /Riprova/);
});

test("RFQH3 does not allow supplier list mutation after launch", () => {
  assert.match(dispatchPanel, /campaignStatus === "draft" \|\| campaignStatus === "ready"/);
  assert.match(migration, /s\.status<>'draft'/);
});


test("RFQH3 keeps anonymous privileged code out of public and private schemas", () => {
  assert.match(capabilityHardening, /create schema if not exists rfqh_secure/);
  assert.match(capabilityHardening, /rfqh_secure\.rfqh3_open_invite_impl/);
  assert.match(capabilityHardening, /rfqh_secure\.rfqh3_ingest_resend_event_impl/);
  assert.match(capabilityHardening, /revoke usage on schema private from anon/);
  assert.match(
    capabilityHardening,
    /create or replace function public\.rfqh3_open_invite[\s\S]*?security invoker/,
  );
  assert.match(
    capabilityHardening,
    /create or replace function public\.rfqh3_ingest_resend_event[\s\S]*?security invoker/,
  );
  assert.match(migration, /buyer_rfq_webhook_events_deny_all/);
  assert.match(migration, /buyer_rfq_email_suppressions_deny_all/);
});


test("RFQH3 reminder closure keeps a message-level provider ledger", () => {
  assert.match(
    reminderMigration,
    /create table if not exists public\.buyer_rfq_dispatch_messages/,
  );
  assert.match(reminderMigration, /unique\(dispatch_id,message_kind,sequence\)/);
  assert.match(reminderMigration, /provider_message_id text null unique/);
  assert.match(reminderMigration, /message_kind in \('invite','reminder'\)/);
  assert.match(reminderMigration, /rfqh3_mark_dispatch_result_impl/);
});

test("RFQH3 reminders are server-governed with cooldown, cap and suppression", () => {
  assert.match(reminderMigration, /rfqh3_prepare_reminder_impl/);
  assert.match(reminderMigration, /reminder_count >= 2/);
  assert.match(reminderMigration, /interval '24 hours'/);
  assert.match(reminderMigration, /Daily reminder limit reached/);
  assert.match(reminderMigration, /Supplier email is suppressed/);
  assert.match(reminderMigration, /supplier\.status not in \('sent','delivered','opened'\)/);
  assert.match(actions, /sendBuyerRfqReminders/);
  assert.match(actions, /createRfqh3ReminderIdempotencyKey/);
  assert.match(dispatchPanel, /Invia promemoria governato/);
  assert.match(dispatchPanel, /massimo 2 per fornitore/);
});

test("RFQH3 reminder emails reuse the current secure invite token without exposing target pricing", () => {
  assert.match(dispatchLib, /buildRfqh3ReminderEmail/);
  assert.match(dispatchLib, /Promemoria RFQ/);
  assert.match(dispatchLib, /Promemoria .* di 2/);
  assert.doesNotMatch(
    dispatchLib.match(/export function buildRfqh3ReminderEmail[\s\S]*$/)?.[0] ?? "",
    /targetEurT|targetEurM|target_eur_t|target_eur_m/,
  );
});

test("RFQH3 webhook tracks async failure and suppression events at message level", () => {
  assert.match(webhook, /email\.failed/);
  assert.match(webhook, /email\.suppressed/);
  assert.match(reminderMigration, /buyer_rfq_dispatch_messages m/);
  assert.match(reminderMigration, /v_message\.message_kind='invite'/);
});
