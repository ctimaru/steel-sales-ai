import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261008110000_nc22_router_idempotency_outbox.sql");
const sqlTest = read("../../../supabase/tests/nc22_notification_router_idempotency_outbox.sql");
const gate = read("../../../.github/workflows/p0-required-gate.yml");
const contract = read("../lib/notification-domain-contract.ts");
const docs = read("../../../docs/nc2-2-notification-router-idempotency-outbox.md");

test("NC2.2: outbox is physically segregated and service-only", () => {
  for (const table of ["workspace_notification_outbox","platform_notification_outbox"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /from public,anon,authenticated/);
  assert.match(migration, /to service_role;/);
  assert.match(migration, /on conflict on constraint nc22_workspace_outbox_unique do nothing/);
  assert.match(migration, /on conflict on constraint nc22_platform_outbox_unique do nothing/);
});

test("NC2.2: no client-callable privileged router, no arbitrary recipients", () => {
  assert.match(migration, /create or replace function public\.nc22_route_notification/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /if current_user <> 'service_role'/);
  assert.match(migration, /revoke all on function public\.nc22_route_notification/);
  assert.match(migration, /from public,anon,authenticated/);
  assert.doesNotMatch(migration, /p_recipient_user_ids|p_email|p_payload|p_url|p_content/);
  assert.doesNotMatch(migration, /net\.http_(post|get)|pg_net|http_request\(/i);
});

test("NC2.2: strict source verification and idempotency stay enforced in SQL", () => {
  assert.match(migration, /and a\.organization_id=p_organization_id/);
  assert.match(migration, /and a\.status='open' and a\.severity='critical'/);
  assert.match(migration, /and j\.status='failed' and j\.completed_at is not null/);
  assert.match(migration, /and j\.attempt_number=p_source_revision/);
  assert.match(migration, /public\.marketplace_unlocks/);
  assert.match(migration, /public\.platform_registration_events/);
  assert.match(migration, /public\.network_company_claims/);
  assert.match(migration, /source unavailable, stale or not eligible/);
  assert.match(migration, /RFQ source bridge not yet approved/);
  assert.match(migration, /on conflict on constraint nc21_workspace_dedupe do nothing/);
  assert.match(migration, /on conflict on constraint nc21_platform_dedupe do nothing/);
  assert.match(migration, /non-canonical source ID/);
  assert.match(migration, /no eligible tenant recipients/);
  assert.match(migration, /no eligible Platform recipients/);
});

test("NC2.2: scope and permission selection never mix tenant and Platform", () => {
  assert.match(migration, /v_scope='workspace' and p_organization_id is null/);
  assert.match(migration, /v_scope='platform' and p_organization_id is not null/);
  assert.match(migration, /m\.organization_id=p_organization_id and m\.status='active'/);
  assert.match(migration, /pr\.status='active'/);
  assert.match(migration, /ps\.status='active' and pp\.permission_key=v_permission/);
  assert.match(migration, /registration.*review/);
  assert.match(migration, /claims\.read/);
  assert.match(migration, /platform\.audit\.read/);
});

test("NC2.2: email held and not sent; in-app delivered means DB projection only", () => {
  assert.match(migration, /channel <> 'email' or status='held'/);
  assert.match(migration, /select r\.id,'in_app','delivered',now\(\)/);
  assert.match(migration, /'email_dispatched',false/);
  assert.match(docs, /not WebSocket delivery/);
  assert.match(docs, /No external HTTP/);
  assert.match(docs, /NC2\.3/);
});

test("NC2.2: transactional negative acceptance included in required gate", () => {
  assert.match(sqlTest,/^begin;/m);
  assert.match(sqlTest,/^rollback;/m);
  assert.match(sqlTest,/service_role only/);
  assert.match(sqlTest,/no email was enqueued/);
  assert.match(sqlTest,/import owner sees their notification/);
  assert.match(sqlTest,/tenant B cannot read tenant A/);
  assert.match(sqlTest,/RFQ subtype not yet source-verified/);
  assert.match(gate,/nc22_notification_router_idempotency_outbox\.sql/);
  assert.match(contract, /NC1\.3-v1/);
});
