export type Rfqh13TeamRole = "collaborator" | "approver";
export type Rfqh13ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled"
  | "consumed";

export type Rfqh13GovernanceState = {
  contract?: string;
  rfq_id: string;
  organization_id: string;
  current_user: {
    role: "owner" | "admin" | "approver" | "collaborator" | "viewer";
    can_manage: boolean;
    can_manage_team: boolean;
    can_approve: boolean;
    is_org_admin: boolean;
  };
  governance: {
    require_award_approval: boolean;
    require_po_approval: boolean;
    approval_expiry_hours: number;
    operational_event_retention_days: number;
    webhook_payload_retention_days: number;
    commercial_record_retention_days: number | null;
    retention_enforcement: "policy_only";
    automatic_commercial_purge: false;
  };
  team: Array<{
    user_id: string;
    email: string;
    role: Rfqh13TeamRole;
    status: "active" | "revoked";
    added_by: string;
    created_at: string;
    revoked_at: string | null;
  }>;
  available_members: Array<{
    user_id: string;
    email: string;
    organization_role: string;
    business_role: string | null;
  }>;
  approvals: Array<{
    id: string;
    action_type: "award" | "po_issue";
    po_draft_id: string | null;
    status: Rfqh13ApprovalStatus;
    reason: string | null;
    requested_by: string;
    requested_at: string;
    expires_at: string;
    decided_by: string | null;
    decided_at: string | null;
    decision_note: string | null;
    consumed_at: string | null;
    payload_snapshot?: Record<string, unknown> | null;
  }>;
  health: {
    stale_dispatches: number;
    failed_dispatches: number;
    bounced_or_complained: number;
    suppressed_recipients: number;
    po_delivery_failures: number;
    pending_approvals: number;
    expired_approvals: number;
  };
  stale_dispatches: Array<{
    id: string;
    supplier_id: string;
    status: string;
    queued_at: string | null;
    last_attempt_at: string | null;
    last_error: string | null;
  }>;
  acceptance: {
    supplier_count: number;
    submitted_quote_count: number;
    award_confirmed: boolean;
    po_count: number;
    po_confirmed_count: number;
    e2e_complete: boolean;
  };
};

export type Rfqh13ApprovalRequestResult = {
  required?: boolean;
  status?: "not_required" | "pending" | "approved";
  approval_id?: string;
  expires_at?: string;
  payload_sha256?: string;
};
