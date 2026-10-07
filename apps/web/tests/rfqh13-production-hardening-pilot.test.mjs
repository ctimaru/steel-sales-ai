import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const teamMigration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261007095803_rfqh13_governance_team_rls.sql", import.meta.url),
  "utf8",
);
const approvalMigration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261007100300_rfqh13_approval_recovery_audit.sql", import.meta.url),
  "utf8",
);
const gateMigration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261007100440_rfqh13_core_approval_gate_enforcement.sql", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx", import.meta.url),
  "utf8",
);
const panel = fs.readFileSync(
  new URL("../components/rfqh13-governance-panel.tsx", import.meta.url),
  "utf8",
);
const awardActions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/award-actions.ts", import.meta.url),
  "utf8",
);
const poActions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/[rfqId]/po-actions.ts", import.meta.url),
  "utf8",
);
const auditRoute = fs.readFileSync(
  new URL("../app/api/rfqh13/audit/[rfqId]/route.ts", import.meta.url),
  "utf8",
);

test("RFQH13 adds procurement team roles without duplicating organization RBAC", () => {
  assert.match(teamMigration, /buyer_rfq_team_members/);
  assert.match(teamMigration, /collaborator/);
  assert.match(teamMigration, /approver/);
  assert.match(teamMigration, /organization_memberships/);
  assert.match(teamMigration, /rfqh13_is_org_admin/);
});

test("RFQH13 shares RFQ read access through owner admin and explicit team membership", () => {
  assert.match(teamMigration, /rfqh13_can_view_rfq/);
  assert.match(teamMigration, /buyer_rfq_campaigns_team_select/);
  assert.match(teamMigration, /buyer_rfq_quotes_team_select/);
  assert.match(teamMigration, /buyer_purchase_order_versions_team_select/);
  assert.match(teamMigration, /buyer_distintas_shared_rfq_select/);
});

test("RFQH13 approval ledger is fingerprinted expiring and separation-of-duties aware", () => {
  assert.match(approvalMigration, /buyer_procurement_approvals/);
  assert.match(approvalMigration, /rfqh13_award_fingerprint/);
  assert.match(approvalMigration, /rfqh13_po_fingerprint/);
  assert.match(approvalMigration, /Requester cannot approve or reject own request/);
  assert.match(approvalMigration, /payload_sha256/);
  assert.match(approvalMigration, /expires_at/);
});

test("RFQH13 approval gates are enforced inside award and PO core functions", () => {
  assert.match(gateMigration, /rfqh13_assert_award_approval/);
  assert.match(gateMigration, /rfqh13_assert_po_approval/);
  assert.match(gateMigration, /rfqh13_consume_approval/);
  assert.match(awardActions, /rfqh13_request_approval/);
  assert.match(poActions, /rfqh13_request_approval/);
});

test("RFQH13 exposes safe recovery only for stale dispatches without provider evidence", () => {
  assert.match(approvalMigration, /rfqh13_mark_stale_dispatch_failed/);
  assert.match(approvalMigration, /provider_message_id is not null/);
  assert.match(approvalMigration, /interval '15 minutes'/);
  assert.match(approvalMigration, /dispatch_recovery_force_failed/);
});

test("RFQH13 provides an authenticated sanitized audit export", () => {
  assert.match(approvalMigration, /RFQH13-audit-export-v1/);
  assert.match(approvalMigration, /- 'token_hash'/);
  assert.match(approvalMigration, /- 'provider_message_id'/);
  assert.match(auditRoute, /authentication_required/);
  assert.match(auditRoute, /rfqh13_export_audit/);
  assert.match(auditRoute, /Cache-Control/);
});

test("RFQH13 UI is role aware and exposes health and pilot acceptance", () => {
  assert.match(page, /Rfqh13GovernancePanel/);
  assert.match(page, /rfqh13_governance_state/);
  assert.match(page, /canExecuteCritical/);
  assert.match(panel, /Team RFQ/);
  assert.match(panel, /Approval gate/);
  assert.match(panel, /Health &amp; recovery/);
  assert.match(panel, /Pilot acceptance/);
  assert.match(panel, /Scarica audit JSON/);
});

test("RFQH13 retention is policy-only and never silently deletes commercial records", () => {
  assert.match(approvalMigration, /retention_enforcement','policy_only/);
  assert.match(approvalMigration, /automatic_commercial_purge',false/);
  assert.match(panel, /non una cancellazione automatica/);
});
