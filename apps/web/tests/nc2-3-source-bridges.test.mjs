import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const f = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const router = f("../../../supabase/migrations/20261008113000_nc23_verified_rfq_router.sql");
const queue = f("../../../supabase/migrations/20261008114000_nc23_source_bridge_queue.sql");
const capture = f("../../../supabase/migrations/20261008114100_nc23_source_event_capture_triggers.sql");
const wake = f("../../../supabase/migrations/20261008114200_nc23_marketplace_unlock_wakeup.sql");
const schedule = f("../../../supabase/migrations/20261008114300_nc23_source_bridge_cron.sql");
const sql = f("../../../supabase/tests/nc23_source_bridges.sql");
const gate = f("../../../.github/workflows/p0-required-gate.yml");

test("NC2.3: RFQ bridge maps verified immutable ledger labels only", () => {
  assert.match(router, /'quote_submitted'/);
  assert.match(router, /'rfq_award_confirmed'/);
  assert.match(router, /RFQ subtype not yet source-verified/);
  assert.match(router, /join public\.buyer_rfq_campaigns c on c\.id=e\.rfq_id/);
  assert.match(router, /public\.buyer_rfq_team_members/);
  assert.match(router, /and m\.status='active'/);
  assert.match(capture, /when 'quote_submitted'/);
  assert.match(capture, /when 'rfq_award_confirmed'/);
});

test("NC2.3: eight source triggers enqueue references without activating emails", () => {
  assert.equal((capture.match(/create trigger nc23_/g)??[]).length,7);
  assert.match(wake, /create trigger nc23_marketplace_unlock_capture/);
  assert.match(capture, /public\.buyer_rfq_events/);
  assert.match(capture, /public\.worker_jobs/);
  assert.match(capture, /public\.operational_alerts/);
  assert.match(capture, /public\.marketplace_notifications/);
  assert.match(capture, /public\.platform_registration_events/);
  assert.match(capture, /public\.network_company_claims/);
  assert.match(capture, /public\.observability_events/);
  assert.match(capture, /exception when others then/);
  assert.doesNotMatch(capture, /net\.http_post\(/);
  assert.doesNotMatch(capture, /email_dispatched.*true/);
});

test("NC2.3: tenant-aware dedupe and private queue are fail-closed", () => {
  assert.match(queue, /unique nulls not distinct/);
  assert.match(queue, /enable row level security/);
  assert.match(queue, /from public,anon,authenticated/);
  assert.match(queue, /to service_role/);
  assert.match(queue, /for update skip locked/);
  assert.match(queue, /if current_user<>'service_role'/);
  assert.match(queue, /public\.nc22_route_notification/);
  assert.match(queue, /next_attempt_at=now\(\)\+make_interval/);
  assert.match(queue, /n>=12/);
  assert.match(queue, /'email_dispatched',false/);
  assert.match(wake, /public\.marketplace_notifications/);
  assert.match(wake, /status='projected'/);
});

test("NC2.3: cron calls only service-only processor with no network credentials", () => {
  assert.match(schedule, /cron\.schedule/);
  assert.match(schedule, /set local role service_role/);
  assert.match(schedule, /public\.nc23_process_source_bridge_batch\(50\)/);
  assert.doesNotMatch(schedule, /apikey|secret|http_post|mail\.send/i);
});

test("NC2.3: acceptance on actual source transitions runs as rollback-only SQL", () => {
  assert.match(sql, /^begin;/m);
  assert.match(sql, /^rollback;/m);
  assert.match(sql, /quote_submitted/);
  assert.match(sql, /rfq_award_confirmed/);
  assert.match(sql, /six source events automatically captured/);
  assert.match(sql, /six verified sources projected/);
  assert.match(sql, /tenant B cannot read tenant A|foreign company does not see Workspace/);
  assert.match(sql, /no SMTP, email or push enqueued/);
  assert.match(gate, /nc23_source_bridges\.sql/);
});
