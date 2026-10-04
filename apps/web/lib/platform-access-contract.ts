export type PlatformPermissionRisk = "low" | "medium" | "high" | "critical";

export type PlatformPermissionDefinition = {
  key: string;
  area:
    | "platform"
    | "registrations"
    | "discovery"
    | "claims"
    | "knowledge"
    | "network_trust"
    | "tenant_access";
  action: string;
  risk: PlatformPermissionRisk;
  description: string;
};

export const PLATFORM_ROOT_AUTHORITY = {
  legacyRoleKey: "platform_superadmin",
  targetRoleKey: "platform_owner",
  singleton: true,
  assignableToStaff: false,
} as const;

export const PLATFORM_PERMISSIONS = [
  {
    key: "platform.console.access",
    area: "platform",
    action: "access",
    risk: "low",
    description: "Open the Platform Control Plane.",
  },
  {
    key: "platform.staff.read",
    area: "platform",
    action: "staff_read",
    risk: "medium",
    description: "View Platform Staff identities, roles and status.",
  },
  {
    key: "platform.staff.invite",
    area: "platform",
    action: "staff_invite",
    risk: "critical",
    description: "Invite a new Platform Staff identity.",
  },
  {
    key: "platform.staff.manage_roles",
    area: "platform",
    action: "staff_manage_roles",
    risk: "critical",
    description: "Assign or remove Platform Staff role templates.",
  },
  {
    key: "platform.staff.suspend",
    area: "platform",
    action: "staff_suspend",
    risk: "critical",
    description: "Suspend or revoke Platform Staff access.",
  },
  {
    key: "platform.audit.read",
    area: "platform",
    action: "audit_read",
    risk: "medium",
    description: "Read the global privileged-action audit trail.",
  },
  {
    key: "platform.settings.manage",
    area: "platform",
    action: "settings_manage",
    risk: "critical",
    description: "Change global platform configuration.",
  },

  {
    key: "registrations.read",
    area: "registrations",
    action: "read",
    risk: "low",
    description: "Read the company registration queue and application detail.",
  },
  {
    key: "registrations.review",
    area: "registrations",
    action: "review",
    risk: "medium",
    description: "Start and perform registration identity review.",
  },
  {
    key: "registrations.request_information",
    area: "registrations",
    action: "request_information",
    risk: "medium",
    description: "Request additional information from an applicant.",
  },
  {
    key: "registrations.approve",
    area: "registrations",
    action: "approve",
    risk: "high",
    description: "Approve a company registration application.",
  },
  {
    key: "registrations.reject",
    area: "registrations",
    action: "reject",
    risk: "high",
    description: "Reject a company registration application.",
  },
  {
    key: "registrations.activate",
    area: "registrations",
    action: "activate",
    risk: "high",
    description: "Activate an approved company workspace.",
  },
  {
    key: "registrations.bridge_network",
    area: "registrations",
    action: "bridge_network",
    risk: "high",
    description: "Link an activated registration to the Network identity graph.",
  },

  {
    key: "discovery.read",
    area: "discovery",
    action: "read",
    risk: "low",
    description: "Read Company Discovery runs, candidates and evidence.",
  },
  {
    key: "discovery.run",
    area: "discovery",
    action: "run",
    risk: "medium",
    description: "Start a Company Discovery crawl batch.",
  },
  {
    key: "discovery.review",
    area: "discovery",
    action: "review",
    risk: "medium",
    description: "Review Company Discovery candidates and evidence.",
  },
  {
    key: "discovery.publish",
    area: "discovery",
    action: "publish",
    risk: "high",
    description: "Publish an accepted candidate as a public Network company.",
  },
  {
    key: "discovery.enrich",
    area: "discovery",
    action: "enrich",
    risk: "high",
    description: "Apply selected public evidence to an existing Network company.",
  },
  {
    key: "discovery.close_duplicates",
    area: "discovery",
    action: "close_duplicates",
    risk: "high",
    description: "Close exact discovery matches as duplicates without merging identities.",
  },
  {
    key: "discovery.governance_review",
    area: "discovery",
    action: "governance_review",
    risk: "critical",
    description:
      "Approve or block source reuse and candidate company-data publication under the PA1.5 legal/data-governance gate.",
  },

  {
    key: "claims.read",
    area: "claims",
    action: "read",
    risk: "low",
    description: "Read company ownership claims and proof evidence.",
  },
  {
    key: "claims.review_proof",
    area: "claims",
    action: "review_proof",
    risk: "medium",
    description: "Verify or reject ownership proof.",
  },
  {
    key: "claims.approve",
    area: "claims",
    action: "approve",
    risk: "high",
    description: "Approve a company ownership claim.",
  },
  {
    key: "claims.reject",
    area: "claims",
    action: "reject",
    risk: "high",
    description: "Reject a company ownership claim.",
  },
  {
    key: "claims.revoke",
    area: "claims",
    action: "revoke",
    risk: "high",
    description: "Revoke an existing company ownership claim.",
  },

  {
    key: "knowledge.read_drafts",
    area: "knowledge",
    action: "read_drafts",
    risk: "low",
    description: "Read unpublished Knowledge editorial content.",
  },
  {
    key: "knowledge.edit",
    area: "knowledge",
    action: "edit",
    risk: "medium",
    description: "Create and edit Knowledge drafts.",
  },
  {
    key: "knowledge.review",
    area: "knowledge",
    action: "review",
    risk: "medium",
    description: "Review editorial quality, sources and readiness blockers.",
  },
  {
    key: "knowledge.publish",
    area: "knowledge",
    action: "publish",
    risk: "high",
    description: "Publish or unpublish Knowledge content.",
  },
  {
    key: "knowledge.quality_audit",
    area: "knowledge",
    action: "quality_audit",
    risk: "medium",
    description: "Read Knowledge freshness, SEO and publication-readiness audits.",
  },

  {
    key: "network_trust.read",
    area: "network_trust",
    action: "read",
    risk: "low",
    description:
      "Read Network verification evidence, current verification state, change reviews and identity-resolution candidates.",
  },
  {
    key: "network_trust.assert",
    area: "network_trust",
    action: "assert",
    risk: "medium",
    description:
      "Create append-only Platform evidence assertions from approved public or manual-review sources.",
  },
  {
    key: "network_trust.verify",
    area: "network_trust",
    action: "verify",
    risk: "high",
    description:
      "Record a current Network verification outcome backed by a matching evidence assertion.",
  },
  {
    key: "network_trust.revoke",
    area: "network_trust",
    action: "revoke",
    risk: "high",
    description: "Revoke or expire a current Network verification.",
  },
  {
    key: "network_trust.review_changes",
    area: "network_trust",
    action: "review_changes",
    risk: "high",
    description:
      "Open and decide Network provenance conflicts without silently overwriting source evidence.",
  },
  {
    key: "network_trust.identity_refresh",
    area: "network_trust",
    action: "identity_refresh",
    risk: "medium",
    description:
      "Refresh deterministic Network identity-resolution candidates without performing merges.",
  },
  {
    key: "network_trust.identity_review",
    area: "network_trust",
    action: "identity_review",
    risk: "high",
    description:
      "Confirm or dismiss identity-resolution candidates; confirmed matches never merge automatically.",
  },

  {
    key: "tenant_access.break_glass",
    area: "tenant_access",
    action: "break_glass",
    risk: "critical",
    description:
      "Reserved emergency tenant-private-data access. Not implemented in SA1 and never granted by a staff role template.",
  },
] as const satisfies readonly PlatformPermissionDefinition[];

export type PlatformPermissionKey = (typeof PLATFORM_PERMISSIONS)[number]["key"];

export type PlatformStaffRoleKey =
  | "registration_admin"
  | "network_operations_admin"
  | "claims_verification_admin"
  | "knowledge_editor"
  | "knowledge_publisher"
  | "network_trust_admin"
  | "platform_auditor";

export type PlatformStaffRoleTemplate = {
  key: PlatformStaffRoleKey;
  label: string;
  description: string;
  permissions: readonly PlatformPermissionKey[];
};

const CONSOLE_ACCESS: PlatformPermissionKey = "platform.console.access";

export const PLATFORM_STAFF_ROLE_TEMPLATES = [
  {
    key: "registration_admin",
    label: "Registration Admin",
    description: "Runs company onboarding from review through activation and Network bridge.",
    permissions: [
      CONSOLE_ACCESS,
      "registrations.read",
      "registrations.review",
      "registrations.request_information",
      "registrations.approve",
      "registrations.reject",
      "registrations.activate",
      "registrations.bridge_network",
    ],
  },
  {
    key: "network_operations_admin",
    label: "Network Operations Admin",
    description: "Operates Company Discovery and controlled public Network enrichment.",
    permissions: [
      CONSOLE_ACCESS,
      "discovery.read",
      "discovery.run",
      "discovery.review",
      "discovery.publish",
      "discovery.enrich",
      "discovery.close_duplicates",
    ],
  },
  {
    key: "claims_verification_admin",
    label: "Claims & Ownership Admin",
    description:
      "Processes company ownership proofs and claim lifecycle decisions; Network verification is a separate Trust role.",
    permissions: [
      CONSOLE_ACCESS,
      "claims.read",
      "claims.review_proof",
      "claims.approve",
      "claims.reject",
      "claims.revoke",
    ],
  },
  {
    key: "knowledge_editor",
    label: "Knowledge Editor",
    description: "Prepares and reviews Knowledge content but cannot publish it.",
    permissions: [
      CONSOLE_ACCESS,
      "knowledge.read_drafts",
      "knowledge.edit",
      "knowledge.review",
      "knowledge.quality_audit",
    ],
  },
  {
    key: "knowledge_publisher",
    label: "Knowledge Publisher",
    description: "Reviews and publishes Knowledge content; draft editing remains a separate responsibility.",
    permissions: [
      CONSOLE_ACCESS,
      "knowledge.read_drafts",
      "knowledge.review",
      "knowledge.publish",
      "knowledge.quality_audit",
    ],
  },
  {
    key: "network_trust_admin",
    label: "Network Trust Admin",
    description:
      "Reviews public Network evidence, verification states, provenance conflicts and identity candidates without tenant-private access or automatic merges.",
    permissions: [
      CONSOLE_ACCESS,
      "network_trust.read",
      "network_trust.assert",
      "network_trust.verify",
      "network_trust.revoke",
      "network_trust.review_changes",
      "network_trust.identity_refresh",
      "network_trust.identity_review",
    ],
  },
  {
    key: "platform_auditor",
    label: "Platform Auditor",
    description: "Read-only platform oversight across operational queues and privileged-action audit.",
    permissions: [
      CONSOLE_ACCESS,
      "platform.staff.read",
      "platform.audit.read",
      "registrations.read",
      "discovery.read",
      "claims.read",
      "knowledge.read_drafts",
      "knowledge.quality_audit",
      "network_trust.read",
    ],
  },
] as const satisfies readonly PlatformStaffRoleTemplate[];

export const ROOT_ONLY_PERMISSIONS = [
  "platform.staff.invite",
  "platform.staff.manage_roles",
  "platform.staff.suspend",
  "platform.settings.manage",
  "discovery.governance_review",
  "tenant_access.break_glass",
] as const satisfies readonly PlatformPermissionKey[];

export const PLATFORM_ROUTE_PERMISSION_CONTRACT = [
  { route: "/platform", permission: "platform.console.access" },
  { route: "/platform/people", permission: "platform.staff.read" },
  { route: "/platform/audit", permission: "platform.audit.read" },
  { route: "/platform/registrations", permission: "registrations.read" },
  { route: "/platform/company-discovery", permission: "discovery.read" },
  { route: "/platform/company-claims", permission: "claims.read" },
  { route: "/platform/knowledge", permission: "knowledge.read_drafts" },
  { route: "/platform/network-trust", permission: "network_trust.read" },
] as const satisfies readonly {
  route: string;
  permission: PlatformPermissionKey;
}[];

export const PLATFORM_ACTION_PERMISSION_CONTRACT = {
  requestRegistrationInformation: "registrations.request_information",
  approveRegistrationApplication: "registrations.approve",
  rejectRegistrationApplication: "registrations.reject",
  activateRegistrationApplication: "registrations.activate",
  bridgeRegistrationToNetwork: "registrations.bridge_network",
  startCompanyDiscovery: "discovery.run",
  reviewCompanyDiscovery: "discovery.review",
  publishCompanyDiscovery: "discovery.publish",
  enrichCompanyDiscovery: "discovery.enrich",
  closeExactDiscoveryDuplicates: "discovery.close_duplicates",
  reviewDiscoverySourceGovernance: "discovery.governance_review",
  reviewDiscoveryCandidateGovernance: "discovery.governance_review",
  reviewCompanyDataRequest: "discovery.governance_review",
  reviewCompanyClaimProof: "claims.review_proof",
  approveCompanyClaim: "claims.approve",
  rejectCompanyClaim: "claims.reject",
  revokeCompanyClaim: "claims.revoke",
  saveKnowledgeDraft: "knowledge.edit",
  submitKnowledgeReview: "knowledge.edit",
  reviewKnowledgeDraft: "knowledge.review",
  publishKnowledgePage: "knowledge.publish",
  createNetworkTrustAssertion: "network_trust.assert",
  recordNetworkVerification: "network_trust.verify",
  revokeNetworkVerification: "network_trust.revoke",
  openNetworkChangeReview: "network_trust.review_changes",
  decideNetworkChangeReview: "network_trust.review_changes",
  refreshNetworkIdentityCandidates: "network_trust.identity_refresh",
  reviewNetworkIdentityCandidate: "network_trust.identity_review",
} as const satisfies Record<string, PlatformPermissionKey>;
