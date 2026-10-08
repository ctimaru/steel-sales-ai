import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  NOTIFICATION_CATALOG,
  NOTIFICATION_CONTRACT_VERSION,
  validateNotificationCandidate,
} from "../lib/notification-domain-contract.ts";

const ORG_A = "00000000-0000-0000-0000-000000001301";
const ORG_B = "00000000-0000-0000-0000-000000001302";
const now = "2026-10-08T09:00:00.000Z";

function candidateFor(eventType, organizationId) {
  const definition = NOTIFICATION_CATALOG[eventType];
  return {
    contractVersion: NOTIFICATION_CONTRACT_VERSION,
    eventType,
    scope: definition.scope,
    sourceTable: definition.sourceTable,
    sourceEventId: "semantic-event-123",
    sourceRevision: 1,
    organizationId: organizationId === undefined ? definition.scope === "workspace" ? ORG_A : null : organizationId,
    occurredAt: now,
  };
}

test("NC1.3: event catalogue has stable unique scopes and controlled sources", () => {
  const entries = Object.entries(NOTIFICATION_CATALOG);
  assert.ok(entries.length >= 10);
  assert.ok(entries.some(([kind]) => kind.startsWith("platform.")));
  assert.ok(entries.some(([kind]) => kind.startsWith("workspace.")));
  for (const [kind, definition] of entries) {
    assert.match(kind, /^(workspace|platform)\.[a-z_]+\.[a-z_]+$/);
    assert.equal(kind.split(".")[0], definition.scope);
    assert.equal(definition.delivery.inApp, true);
    assert.equal(definition.delivery.push, false);
    assert.ok(["off","opt_in","actionable","critical"].includes(definition.delivery.email));
    assert.ok(["informational","action_required","critical"].includes(definition.priority));
    assert.ok(definition.sourceTable.length > 0);
    assert.ok(definition.recipientPolicy.length > 0);
    assert.ok(definition.destination.length > 0);
    assert.equal(validateNotificationCandidate(candidateFor(kind)).ok, true, kind);
  }
});

test("NC1.3: reject unknown source, scope mismatch and events", () => {
  const valid = candidateFor("workspace.marketplace.opportunity_matched");
  assert.deepEqual(validateNotificationCandidate({ ...valid, scope:"platform" }), {ok:false,reason:"scope_mismatch"});
  assert.deepEqual(validateNotificationCandidate({ ...valid, sourceTable:"observability_events" }), {ok:false,reason:"source_mismatch"});
  assert.deepEqual(validateNotificationCandidate({ ...valid, eventType:"workspace.marketplace.money" }), {ok:false,reason:"unknown_event"});
  assert.deepEqual(validateNotificationCandidate({ ...valid, eventType:"__proto__" }), {ok:false,reason:"unknown_event"});
});

test("NC1.3: strict tenant boundary does not mix Platform and Workspace", () => {
  const workspace = candidateFor("workspace.rfq.response_received");
  const platform = candidateFor("platform.registration.submitted");
  assert.deepEqual(validateNotificationCandidate({ ...workspace,organizationId:null }), {ok:false,reason:"tenant_boundary"});
  assert.deepEqual(validateNotificationCandidate({ ...workspace,organizationId:"company-a" }), {ok:false,reason:"tenant_boundary"});
  assert.deepEqual(validateNotificationCandidate({ ...platform,organizationId:ORG_A }), {ok:false,reason:"tenant_boundary"});
  assert.equal(validateNotificationCandidate(platform).ok,true);
  const a = validateNotificationCandidate(workspace);
  const b = validateNotificationCandidate({...workspace,organizationId:ORG_B});
  assert.equal(a.ok,true);
  assert.equal(b.ok,true);
  assert.notEqual(a.dedupeKey,b.dedupeKey);
});

test("NC1.3: reject content-bearing payloads, untrusted links, and malformed source IDs", () => {
  const candidate = candidateFor("workspace.import.failed");
  for (const injected of [
    {payload:{supplierName:"Private customer"}},
    {customerName:"Private customer"},
    {email:"private@example.com"},
    {body:"confidential offer"},
    {path:"https://attacker.example"},
    {recipientUserId:"00000000-0000-0000-0000-000000000004"},
  ]) {
    assert.deepEqual(validateNotificationCandidate({...candidate,...injected}), {ok:false,reason:"invalid_envelope"});
  }
  for (const sourceEventId of ["", "../../private", "hello world", "a".repeat(129)]) {
    assert.deepEqual(validateNotificationCandidate({...candidate,sourceEventId}), {ok:false,reason:"invalid_envelope"});
  }
});

test("NC1.3: monotonic source revisions produce stable idempotency keys", () => {
  const input = candidateFor("workspace.operations.regression_detected");
  const a=validateNotificationCandidate(input);
  const repeated=validateNotificationCandidate({...input,occurredAt:"2026-10-08T11:00:00Z"});
  const changed=validateNotificationCandidate({...input,sourceRevision:2});
  assert.equal(a.ok,true);
  assert.equal(repeated.ok,true);
  assert.equal(changed.ok,true);
  assert.equal(a.dedupeKey,repeated.dedupeKey,"replay must dedupe regardless of ingestion time");
  assert.notEqual(a.dedupeKey,changed.dedupeKey,"new business transition must not be lost");
  for (const sourceRevision of [0,-1,1.5,"1",Number.MAX_SAFE_INTEGER+10]) {
    assert.deepEqual(validateNotificationCandidate({...input,sourceRevision}),{ok:false,reason:"invalid_envelope"});
  }
});

test("NC1.3: invalid contract and timestamp reject input", () => {
  const valid=candidateFor("platform.infrastructure.critical_incident");
  assert.deepEqual(validateNotificationCandidate({...valid,contractVersion:"NC1.2-v0"}),{ok:false,reason:"invalid_envelope"});
  assert.deepEqual(validateNotificationCandidate({...valid,occurredAt:"bad-date"}),{ok:false,reason:"invalid_envelope"});
  assert.deepEqual(validateNotificationCandidate([]),{ok:false,reason:"invalid_envelope"});
  assert.deepEqual(validateNotificationCandidate(null),{ok:false,reason:"invalid_envelope"});
});

test("NC1.3: catalogue enforces no cross-context recipients", () => {
  const workspaceResolvers=new Set([
    "authorized_rfq_assignees","entitled_marketplace_users",
    "job_owner_and_org_admins","active_organization_admins",
  ]);
  const platformResolvers=new Set([
    "platform_registration_reviewers","platform_claim_reviewers",
    "platform_incident_responders",
  ]);
  for (const def of Object.values(NOTIFICATION_CATALOG)) {
    assert.ok((def.scope==="workspace" ? workspaceResolvers : platformResolvers).has(def.recipientPolicy));
  }
  assert.equal(NOTIFICATION_CATALOG["workspace.operations.regression_detected"].scope,"workspace");
  assert.equal(NOTIFICATION_CATALOG["platform.infrastructure.critical_incident"].sourceTable,"observability_events");
});

test("NC1.3: this release does not activate delivery or schema changes", () => {
  const doc = fs.readFileSync(new URL("../../../docs/nc1-3-notification-domain-contract.md",import.meta.url),"utf8");
  assert.match(doc,/no router, delivery, inbox, email, DB migration/i);
  assert.match(doc,/not presumed literal database event types/);
  assert.match(doc,/recipient resolvers.*not connected/i);
  assert.match(doc,/separate.*scope|scope.*separate/i);
  assert.match(doc,/sourceRevision/);
  assert.match(doc,/NC2\.1/);
});
