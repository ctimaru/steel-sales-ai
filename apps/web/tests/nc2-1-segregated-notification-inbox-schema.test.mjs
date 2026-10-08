import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const ddl = read("../../../supabase/migrations/20261008105500_nc21_segregated_notification_inbox_schema.sql");
const acceptance = read("../../../supabase/tests/nc21_segregated_notification_inbox_schema.sql");
const workflow = read("../../../.github/workflows/p0-required-gate.yml");
const docs = read("../../../docs/nc2-1-segregated-notification-inbox-schema.md");

const workspace = ["workspace_notification_events", "workspace_notification_recipients"];
const platform = ["platform_notification_events", "platform_notification_recipients"];
const tables = [...workspace, ...platform];

test("NC2.1: four physically segregated event and recipient tables; no generic merged inbox", () => {
  for (const name of tables) {
    assert.match(ddl, new RegExp(`create table public\\.${name} \\(`));
    assert.match(ddl, new RegExp(`alter table public\\.${name} enable row level security`));
  }
  assert.equal((ddl.match(/create table public\./g) || []).length, 4);
  assert.doesNotMatch(ddl, /create (materialized )?view .*union/i);
  assert.doesNotMatch(ddl, /create table public\.notifications\b/);
});

test("NC2.1: browser can select personal rows only; never write or access anon", () => {
  assert.match(ddl, /revoke all on public\.workspace_notification_events,/);
  assert.match(ddl, /public\.platform_notification_recipients from public,anon,authenticated/);
  assert.match(ddl, /grant select on public\.workspace_notification_events,/);
  assert.match(ddl, /to authenticated;/);
  assert.match(ddl, /to service_role;/);
  assert.match(ddl, /recipient_user_id = \(select auth\.uid\(\)\)/);
  assert.match(ddl, /public\.is_organization_member\(organization_id,false\)/);
  assert.match(ddl, /public\.has_platform_permission\(required_permission_key\)/);
  assert.doesNotMatch(ddl, /grant (insert|update|delete|all) .* to authenticated/i);
});

test("NC2.1: FKs enforce tenant and Platform privilege associations", () => {
  assert.match(ddl, /foreign key \(event_id,organization_id\)/);
  assert.match(ddl, /references public\.workspace_notification_events\(id,organization_id\)/);
  assert.match(ddl, /foreign key \(event_id,required_permission_key\)/);
  assert.match(ddl, /references public\.platform_notification_events\(id,required_permission_key\)/);
  assert.match(ddl, /'registrations\.review'/);
  assert.match(ddl, /'claims\.read'/);
  assert.match(ddl, /'platform\.audit\.read'/);
});

test("NC2.1: per-user states, dedupe and partial unread indexes are present", () => {
  assert.match(ddl, /constraint nc21_workspace_dedupe unique/);
  assert.match(ddl, /constraint nc21_platform_dedupe unique/);
  assert.match(ddl, /constraint nc21_workspace_one_recipient unique/);
  assert.match(ddl, /constraint nc21_platform_one_recipient unique/);
  assert.equal((ddl.match(/where read_at is null and archived_at is null/g)||[]).length, 2);
  assert.equal((ddl.match(/archived_at is null or \(read_at is not null and archived_at >= read_at\)/g)||[]).length, 2);
});

test("NC2.1: DB acceptance is transactional and checked by required gate", () => {
  assert.match(acceptance, /^begin;/m);
  assert.match(acceptance, /^rollback;/m);
  assert.match(acceptance, /'A admin sees only own recipient'/);
  assert.match(acceptance, /'suspended member cannot see event'/);
  assert.match(acceptance, /'Platform role cannot read tenant data'/);
  assert.match(acceptance, /'suspended Platform staff cannot read recipient'/);
  assert.match(acceptance, /'foreign key'/);
  assert.match(acceptance, /'permission denied'/);
  assert.match(workflow, /nc21_segregated_notification_inbox_schema\.sql/);
});

test("NC2.1: no router or delivery is claimed in contract-only schema phase", () => {
  assert.match(docs, /schema foundation only/);
  assert.match(docs, /Source-level entitlement/);
  assert.match(docs, /NC2\.2 — Router/);
  assert.doesNotMatch(ddl, /net\.http_post\s*\(/);
});
