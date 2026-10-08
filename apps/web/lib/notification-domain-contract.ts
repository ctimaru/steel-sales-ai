/**
 * NC1.3 — Notification Domain Contract v1 (design-only, not a delivery engine).
 *
 * Source systems remain authoritative. This catalogue is NOT a permission grant:
 * NC2 must re-check live organization, role, assignment and entitlement at both
 * dispatch and deep-link read. The Platform scope never inherits tenant access.
 */
export const NOTIFICATION_CONTRACT_VERSION = "NC1.3-v1" as const;

export type NotificationScope = "workspace" | "platform";
export type NotificationPriority = "informational" | "action_required" | "critical";
export type NotificationCategory =
  | "procurement" | "marketplace" | "imports" | "operations"
  | "registration" | "claims" | "infrastructure";
export type NotificationRecipientPolicy =
  | "authorized_rfq_assignees"
  | "entitled_marketplace_users"
  | "job_owner_and_org_admins"
  | "active_organization_admins"
  | "platform_registration_reviewers"
  | "platform_claim_reviewers"
  | "platform_incident_responders";
export type NotificationEmailPolicy = "off" | "opt_in" | "actionable" | "critical";
export type NotificationSourceTable =
  | "buyer_rfq_events"
  | "marketplace_notifications"
  | "worker_jobs"
  | "operational_alerts"
  | "platform_registration_events"
  | "network_company_claims"
  | "observability_events";

export type NotificationDefinition = Readonly<{
  scope: NotificationScope;
  category: NotificationCategory;
  priority: NotificationPriority;
  sourceTable: NotificationSourceTable;
  /** For immutable event logs; adapters must validate event type and state. */
  sourceEventType: string | null;
  recipientPolicy: NotificationRecipientPolicy;
  /** Allowed channels, NOT a claim that those transports are deployed. */
  delivery: Readonly<{ inApp: true; email: NotificationEmailPolicy; push: false }>;
  /** A UI hint, never an authorization bypass or unvalidated external URL. */
  destination: "rfq_campaign" | "marketplace_opportunity" | "import_job" |
    "operational_alerts" | "platform_registration" | "platform_claims" | "platform_health";
}>;

// Events without a single immutable source-event row require an explicit revision
// from the domain adapter. No automatic watcher/subscription is enabled by this map.
export const NOTIFICATION_CATALOG = {
  "workspace.rfq.response_received": {
    scope: "workspace", category: "procurement", priority: "action_required",
    sourceTable: "buyer_rfq_events", sourceEventType: null,
    recipientPolicy: "authorized_rfq_assignees",
    delivery: { inApp: true, email: "actionable", push: false },
    destination: "rfq_campaign",
  },
  "workspace.rfq.clarification_requested": {
    scope: "workspace", category: "procurement", priority: "action_required",
    sourceTable: "buyer_rfq_events", sourceEventType: null,
    recipientPolicy: "authorized_rfq_assignees",
    delivery: { inApp: true, email: "actionable", push: false },
    destination: "rfq_campaign",
  },
  "workspace.rfq.award_confirmed": {
    scope: "workspace", category: "procurement", priority: "action_required",
    sourceTable: "buyer_rfq_events", sourceEventType: null,
    recipientPolicy: "authorized_rfq_assignees",
    delivery: { inApp: true, email: "actionable", push: false },
    destination: "rfq_campaign",
  },
  "workspace.rfq.supplier_confirmation_received": {
    scope: "workspace", category: "procurement", priority: "action_required",
    sourceTable: "buyer_rfq_events", sourceEventType: null,
    recipientPolicy: "authorized_rfq_assignees",
    delivery: { inApp: true, email: "actionable", push: false },
    destination: "rfq_campaign",
  },
  "workspace.marketplace.opportunity_matched": {
    scope: "workspace", category: "marketplace", priority: "informational",
    sourceTable: "marketplace_notifications", sourceEventType: "opportunity_match",
    recipientPolicy: "entitled_marketplace_users",
    delivery: { inApp: true, email: "opt_in", push: false },
    destination: "marketplace_opportunity",
  },
  "workspace.import.failed": {
    scope: "workspace", category: "imports", priority: "action_required",
    sourceTable: "worker_jobs", sourceEventType: null,
    recipientPolicy: "job_owner_and_org_admins",
    delivery: { inApp: true, email: "actionable", push: false },
    destination: "import_job",
  },
  "workspace.operations.regression_detected": {
    scope: "workspace", category: "operations", priority: "critical",
    sourceTable: "operational_alerts", sourceEventType: null,
    recipientPolicy: "active_organization_admins",
    delivery: { inApp: true, email: "critical", push: false },
    destination: "operational_alerts",
  },
  "platform.registration.submitted": {
    scope: "platform", category: "registration", priority: "action_required",
    sourceTable: "platform_registration_events", sourceEventType: "application_submitted",
    recipientPolicy: "platform_registration_reviewers",
    delivery: { inApp: true, email: "actionable", push: false },
    destination: "platform_registration",
  },
  "platform.registration.information_provided": {
    scope: "platform", category: "registration", priority: "action_required",
    sourceTable: "platform_registration_events", sourceEventType: "information_provided",
    recipientPolicy: "platform_registration_reviewers",
    delivery: { inApp: true, email: "actionable", push: false },
    destination: "platform_registration",
  },
  "platform.claim.requested": {
    scope: "platform", category: "claims", priority: "action_required",
    sourceTable: "network_company_claims", sourceEventType: "requested",
    recipientPolicy: "platform_claim_reviewers",
    delivery: { inApp: true, email: "actionable", push: false },
    destination: "platform_claims",
  },
  "platform.infrastructure.critical_incident": {
    scope: "platform", category: "infrastructure", priority: "critical",
    sourceTable: "observability_events", sourceEventType: "system",
    recipientPolicy: "platform_incident_responders",
    delivery: { inApp: true, email: "critical", push: false },
    destination: "platform_health",
  },
} as const satisfies Record<string, NotificationDefinition>;

export type NotificationEventType = keyof typeof NOTIFICATION_CATALOG;

export type NotificationCandidate = Readonly<{
  contractVersion: typeof NOTIFICATION_CONTRACT_VERSION;
  eventType: NotificationEventType;
  scope: NotificationScope;
  sourceTable: NotificationSourceTable;
  /** Immutable source event identifier, never a user-provided display string. */
  sourceEventId: string;
  /** Required for workspace, forbidden in platform envelope. */
  organizationId: string | null;
  /** Required when projecting changing source records, such as worker jobs. */
  sourceRevision: number;
  occurredAt: string;
}>;

export type NotificationCandidateResult =
  | { ok: true; candidate: NotificationCandidate; dedupeKey: string }
  | { ok: false; reason: "invalid_envelope" | "unknown_event" | "scope_mismatch" | "source_mismatch" | "tenant_boundary" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const ALLOWED_FIELDS = new Set([
  "contractVersion", "eventType", "scope", "sourceTable", "sourceEventId",
  "organizationId", "sourceRevision", "occurredAt",
]);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Strict, reference-only candidate validation. Rejects content, email addresses,
 * customer names, payload and arbitrary deep-link paths. A successful validation
 * does NOT authorize delivery; the future router must resolve recipients server-side.
 */
export function validateNotificationCandidate(value: unknown): NotificationCandidateResult {
  if (!object(value) || Object.keys(value).some((key) => !ALLOWED_FIELDS.has(key))) {
    return { ok: false, reason: "invalid_envelope" };
  }

  if (value.contractVersion !== NOTIFICATION_CONTRACT_VERSION ||
    typeof value.eventType !== "string" ||
    typeof value.scope !== "string" ||
    typeof value.sourceTable !== "string" ||
    typeof value.sourceEventId !== "string" ||
    !SOURCE_ID.test(value.sourceEventId) ||
    typeof value.sourceRevision !== "number" ||
    !Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 1 ||
    typeof value.occurredAt !== "string" ||
    !Number.isFinite(Date.parse(value.occurredAt))) {
    return { ok: false, reason: "invalid_envelope" };
  }

  if (!Object.prototype.hasOwnProperty.call(NOTIFICATION_CATALOG, value.eventType)) {
    return { ok: false, reason: "unknown_event" };
  }
  const eventType = value.eventType as NotificationEventType;
  const definition: NotificationDefinition = NOTIFICATION_CATALOG[eventType];

  if (value.scope !== definition.scope) return { ok: false, reason: "scope_mismatch" };
  if (value.sourceTable !== definition.sourceTable) return { ok: false, reason: "source_mismatch" };
  if (definition.scope === "workspace" && (typeof value.organizationId !== "string" || !UUID.test(value.organizationId))) {
    return { ok: false, reason: "tenant_boundary" };
  }
  if (definition.scope === "platform" && value.organizationId !== null) {
    return { ok: false, reason: "tenant_boundary" };
  }

  const candidate: NotificationCandidate = {
    contractVersion: NOTIFICATION_CONTRACT_VERSION,
    eventType, scope: definition.scope, sourceTable: definition.sourceTable,
    sourceEventId: value.sourceEventId, organizationId: value.organizationId as string | null,
    sourceRevision: value.sourceRevision, occurredAt: value.occurredAt,
  };

  // Stable internal key. Hash/unique constraint belongs to NC2.1/NC2.2.
  const dedupeKey = JSON.stringify([
    candidate.contractVersion, candidate.scope, candidate.organizationId,
    candidate.eventType, candidate.sourceTable, candidate.sourceEventId, candidate.sourceRevision,
  ]);
  return { ok: true, candidate, dedupeKey };
}
