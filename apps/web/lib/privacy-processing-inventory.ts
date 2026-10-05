export const PROCESSING_INVENTORY_VERSION = "2026-10-04-lr3.1";

export type ProcessingRole =
  | "platform-controller"
  | "tenant-controller-platform-processor"
  | "role-review-required";

export type LegalBasisState =
  | "implemented-consent"
  | "published-provisional"
  | "candidate-review-required"
  | "tenant-controlled"
  | "open";

export type RetentionState =
  | "implemented"
  | "documented-provisional"
  | "open";

export type ProcessingActivity = {
  id: string;
  name: string;
  scope: string;
  role: ProcessingRole;
  notice: "art13" | "art14" | "art13-art14" | "processor-dpa";
  dataSubjects: string[];
  dataCategories: string[];
  purposes: string[];
  sources: string[];
  systems: string[];
  recipients: string[];
  legalBasis: string;
  legalBasisState: LegalBasisState;
  retention: string;
  retentionState: RetentionState;
  transferReview: "lr6-required" | "not-applicable-client-local" | "review-required";
  safeguards: string[];
  nextGate: string;
};

/**
 * LR3.1 canonical application-level processing inventory.
 *
 * This is an accountability map, not final legal sign-off. Where the platform
 * has not yet fixed a legal basis, retention period or controller/processor
 * allocation, the value is deliberately marked candidate/open rather than
 * silently promoted to a compliance claim.
 */
export const PROCESSING_INVENTORY: ProcessingActivity[] = [
  {
    id: "LR3-A01",
    name: "Public site delivery, abuse prevention and security",
    scope: "Public web surfaces, routing and security controls.",
    role: "platform-controller",
    notice: "art13",
    dataSubjects: ["public visitors"],
    dataCategories: ["technical request data", "security and abuse signals"],
    purposes: ["deliver the service", "protect availability and integrity", "prevent abuse"],
    sources: ["service request", "infrastructure-generated"],
    systems: ["Vercel", "application runtime"],
    recipients: ["hosting and infrastructure providers"],
    legalBasis: "Legitimate interest in service security and reliability, subject to balancing and professional review.",
    legalBasisState: "published-provisional",
    retention: "Provider/application security-log periods are not yet consolidated.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: ["data minimisation", "access controls", "no GA4 required for service delivery"],
    nextGate: "LR3.2/LR6",
  },
  {
    id: "LR3-A02",
    name: "Account authentication and email verification",
    scope: "Signup, login, verification, password recovery and authenticated sessions.",
    role: "platform-controller",
    notice: "art13",
    dataSubjects: ["account users"],
    dataCategories: ["email address", "authentication metadata", "session identifiers", "verification state"],
    purposes: ["create and secure accounts", "authenticate users", "recover access"],
    sources: ["direct from user", "authentication provider"],
    systems: ["Supabase Auth", "Smart Steel Sales web app"],
    recipients: ["authentication and hosting providers", "transactional email provider where used"],
    legalBasis: "Pre-contractual/contractual service delivery where applicable; exact wording remains subject to legal review.",
    legalBasisState: "published-provisional",
    retention: "Account lifecycle and post-closure retention are not yet fixed.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: ["email verification", "HttpOnly pending-signup cookie", "RBAC", "session controls"],
    nextGate: "LR6 signed-DPA evidence/LR7",
  },
  {
    id: "LR3-A03",
    name: "Company registration and application review",
    scope: "Company application, review, approval and organization activation.",
    role: "platform-controller",
    notice: "art13",
    dataSubjects: ["company applicants", "company representatives"],
    dataCategories: [
      "account email snapshot",
      "representative name",
      "optional phone",
      "company identifiers and website",
      "application status",
      "review and activation audit metadata",
    ],
    purposes: ["evaluate company onboarding", "prevent duplicate identities", "activate eligible organizations"],
    sources: ["direct from applicant", "existing governed Network identity"],
    systems: ["Supabase", "Smart Steel Sales registration and platform operations"],
    recipients: ["authorized platform operators", "infrastructure providers"],
    legalBasis: "Pre-contractual steps/service administration is the current candidate basis; security/identity checks may also rely on legitimate interests.",
    legalBasisState: "candidate-review-required",
    retention: "Application and review-ledger retention is not yet formally fixed.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: ["email verification", "controlled review queue", "RBAC", "immutable/structured audit events"],
    nextGate: "LR3.2/LR5/LR6",
  },
  {
    id: "LR3-A04",
    name: "Company claim and representative verification",
    scope: "Claim handoff, identity matching, claim review and organization-to-company linking.",
    role: "platform-controller",
    notice: "art13-art14",
    dataSubjects: ["claim applicants", "company representatives", "persons present in source data if any"],
    dataCategories: [
      "claim reference",
      "account identity",
      "company identity",
      "verification and claim status",
      "role/relationship evidence where required",
    ],
    purposes: ["verify authority to claim a company", "prevent duplicate or fraudulent claims", "maintain company identity integrity"],
    sources: ["direct from applicant", "governed company profile data"],
    systems: ["Supabase", "Network claim workflow"],
    recipients: ["authorized platform operators", "infrastructure providers"],
    legalBasis: "Direct-claim processing is linked to requested service/legitimate anti-fraud interests; Art. 14 treatment of source-derived personal data remains open.",
    legalBasisState: "candidate-review-required",
    retention: "Claim and verification evidence retention is not yet formally fixed.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: ["opaque claim_ref", "fail-closed identity checks", "review workflow", "private Network boundary"],
    nextGate: "LR4/LR5/LR6",
  },
  {
    id: "LR3-A05",
    name: "Team invitations, memberships and role onboarding",
    scope: "Organization invitations, acceptance, membership state and role administration.",
    role: "platform-controller",
    notice: "art13",
    dataSubjects: ["invited team members", "organization members"],
    dataCategories: ["email address", "user id", "organization membership", "role", "business role", "invitation lifecycle timestamps"],
    purposes: ["invite users", "grant organization access", "administer roles and membership"],
    sources: ["organization administrator", "account user", "authentication provider"],
    systems: ["Supabase Auth", "Supabase database", "transactional email delivery"],
    recipients: ["organization administrators", "transactional email provider", "infrastructure providers"],
    legalBasis: "Service/contract administration is the current candidate basis; exact allocation between the organization and platform requires review.",
    legalBasisState: "candidate-review-required",
    retention: "Invitation expiry exists technically; broader membership/history retention remains open.",
    retentionState: "documented-provisional",
    transferReview: "lr6-required",
    safeguards: ["organization-admin authorization", "role controls", "invitation expiry", "revocation"],
    nextGate: "LR3.2/LR5/LR6",
  },
  {
    id: "LR3-A06",
    name: "Public-source company discovery, governance and correction intake",
    scope: "Discovery candidates, provenance, governance approval, company lookup and business-data correction/removal/source questions.",
    role: "role-review-required",
    notice: "art14",
    dataSubjects: ["persons identifiable in business-source material, where present"],
    dataCategories: [
      "company identity and public business data",
      "source/provenance metadata",
      "potential personal data detected in source material",
      "correction/removal/source-question intake",
    ],
    purposes: ["build and maintain accurate company records", "govern source reuse", "handle business-data correction and removal requests"],
    sources: ["public web/business sources", "requester-submitted correction intake"],
    systems: ["Supabase governance tables", "public company lookup", "company-data intake"],
    recipients: ["root/platform governance reviewers", "infrastructure providers"],
    legalBasis: "OPEN for personal data obtained indirectly. Company-only data is separately governed but source/licensing and database-rights review still apply.",
    legalBasisState: "open",
    retention: "Source, candidate, governance-event and request retention remains to be fixed.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: [
      "PA1.5 fail-closed source gate",
      "personal-data candidate blocking",
      "governance audit",
      "minimal anonymous lookup",
      "private paid Network boundary",
    ],
    nextGate: "LR4/LR6",
  },
  {
    id: "LR3-A07",
    name: "Public website analytics",
    scope: "GA4 measurement on approved public acquisition surfaces only.",
    role: "platform-controller",
    notice: "art13",
    dataSubjects: ["consenting public visitors"],
    dataCategories: ["analytics identifiers and usage events generated by Google Analytics"],
    purposes: ["measure public acquisition and website usage"],
    sources: ["browser after explicit analytics grant"],
    systems: ["Google Analytics 4", "Smart Steel Sales consent layer"],
    recipients: ["Google Analytics / Google services"],
    legalBasis: "Consent.",
    legalBasisState: "implemented-consent",
    retention: "Consent evidence is locally valid for six months at an unchanged notice version; LR6 sets a 2-month GA4 user/event retention target, with production property verification still required.",
    retentionState: "documented-provisional",
    transferReview: "review-required",
    safeguards: [
      "zero GA4 before consent",
      "accept and necessary-only choices",
      "revocation control",
      "versioned/timestamped consent evidence",
      "private routes excluded",
      "no user id or organization id sent to GA4",
    ],
    nextGate: "LR6 account-level GA4 retention evidence",
  },
  {
    id: "LR3-A08",
    name: "Privacy-minimal public utility discovery telemetry",
    scope: "Anonymous calculator discovery event measurement.",
    role: "platform-controller",
    notice: "art13",
    dataSubjects: ["public visitors"],
    dataCategories: ["event name", "source surface", "surface location", "event timestamp"],
    purposes: ["measure calculator discovery without identifying the visitor"],
    sources: ["public application event"],
    systems: ["Supabase public_utility_events"],
    recipients: ["authorized platform analytics users", "database provider"],
    legalBasis: "No direct identifier is intentionally stored; qualification as personal/non-personal data and any residual metadata exposure must be confirmed.",
    legalBasisState: "candidate-review-required",
    retention: "No deletion period is currently encoded in the WC5 table.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: [
      "no user id",
      "no organization id",
      "no calculator input",
      "no email",
      "no commercial payload",
      "allowlisted event/source/surface values",
    ],
    nextGate: "LR3.2/LR6",
  },
  {
    id: "LR3-A09",
    name: "Private Network interactions and Marketplace activity",
    scope: "Entitlement-gated company discovery, follows/saves, inquiries, marketplace participation and related activity.",
    role: "platform-controller",
    notice: "art13",
    dataSubjects: ["organization users", "business contacts participating through the platform"],
    dataCategories: ["user and organization identifiers", "interaction metadata", "inquiry or marketplace content", "timestamps", "entitlement and moderation state"],
    purposes: ["provide Network and Marketplace functions", "route business interactions", "enforce access and anti-abuse rules"],
    sources: ["authenticated users", "platform-generated workflow state"],
    systems: ["Supabase", "Smart Steel Sales Network and Marketplace"],
    recipients: ["authorized counterparties according to visibility rules", "infrastructure providers"],
    legalBasis: "Contract/service delivery is the current candidate basis; specific marketplace and communication scenarios require final contract/privacy alignment.",
    legalBasisState: "candidate-review-required",
    retention: "Interaction, inquiry and marketplace retention periods are not yet formally fixed.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: ["tenant/role access controls", "entitlement boundary", "privacy-safe teaser/unlock model", "audit and anti-abuse controls"],
    nextGate: "LR3.2/LR6/LR8",
  },
  {
    id: "LR3-A10",
    name: "Commercial Memory ingestion and commercial intelligence",
    scope: "Tenant-private upload/ingestion of emails, RFQs, offers, orders, documents and extracted commercial observations.",
    role: "tenant-controller-platform-processor",
    notice: "processor-dpa",
    dataSubjects: ["tenant employees", "customer/supplier contacts", "other persons contained in tenant commercial communications"],
    dataCategories: [
      "email/document content",
      "contact and conversation identifiers",
      "RFQ/offer/order data",
      "prices and quantities",
      "source evidence",
      "extracted observations and confidence metadata",
    ],
    purposes: ["organize tenant commercial memory", "extract structured commercial data", "enable tenant search and intelligence"],
    sources: ["tenant uploads and connected tenant communication sources"],
    systems: [
      "Railway worker",
      "Supabase Storage/database",
      "Hugging Face Inference Providers (commercial personal-data gate open)",
      "Smart Steel Sales private workspace",
    ],
    recipients: [
      "tenant-authorized users",
      "Supabase",
      "Railway",
      "external AI inference provider only after LR6 approval",
    ],
    legalBasis: "Determined by the tenant controller for its source data; Smart Steel Sales acts in processor context subject to Art. 28 terms/DPA.",
    legalBasisState: "tenant-controlled",
    retention: "Tenant data lifecycle, deletion/export and backup retention require DPA/retention policy finalization.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: [
      "owner/tenant scoping",
      "RLS/RBAC",
      "controlled worker promotion",
      "review queue",
      "Commercial Memory excluded from public-company sourcing",
      "external AI personal-data path blocked for commercial launch until exact provider, DPA, location and transfer safeguards are verified",
    ],
    nextGate: "LR6 AI-provider remediation/LR8",
  },
  {
    id: "LR3-A11",
    name: "Platform audit, registration governance and security operations",
    scope: "Audit ledgers, administrative actions, registration events, governance decisions and security diagnostics.",
    role: "platform-controller",
    notice: "art13-art14",
    dataSubjects: ["users", "applicants", "platform operators", "persons represented in governed records where applicable"],
    dataCategories: ["actor identifiers", "action/event type", "status transitions", "timestamps", "structured metadata", "security/operational context"],
    purposes: ["accountability", "fraud/abuse prevention", "incident investigation", "permissioned platform operations"],
    sources: ["platform-generated", "authorized operator action"],
    systems: ["Supabase audit/event tables", "application/runtime logs"],
    recipients: ["authorized platform operators", "infrastructure providers"],
    legalBasis: "Legitimate security/accountability interests and legal obligations where applicable; final matrix requires review.",
    legalBasisState: "candidate-review-required",
    retention: "Audit/security retention periods are not yet consolidated.",
    retentionState: "open",
    transferReview: "lr6-required",
    safeguards: ["least-privilege permissions", "root-only governance actions where required", "structured audit trail", "deny-by-default internal tables"],
    nextGate: "LR6/LR7",
  },
  {
    id: "LR3-A12",
    name: "Transactional service email",
    scope: "Verification, invitations and other operational messages required to provide the service.",
    role: "platform-controller",
    notice: "art13",
    dataSubjects: ["account users", "invitees", "organization members"],
    dataCategories: ["email address", "delivery metadata", "message purpose/status", "service-linked identifiers where strictly necessary"],
    purposes: ["verify accounts", "deliver invitations", "send operational service communications"],
    sources: ["account/organization workflow", "platform-generated"],
    systems: ["Supabase Auth", "Resend via custom SMTP"],
    recipients: ["Resend"],
    legalBasis: "Service/contract administration is the current candidate basis; marketing is explicitly outside this activity.",
    legalBasisState: "candidate-review-required",
    retention: "LR6 baseline: Resend states 30-day email/log retention on standard plans, 7-day backups and remaining customer-data deletion within 90 days after termination; internal evidence target remains 90 days.",
    retentionState: "documented-provisional",
    transferReview: "review-required",
    safeguards: ["transactional purpose limitation", "no bundled marketing consent", "minimal payload"],
    nextGate: "LR5/LR6",
  },
];

export const PROCESSING_INVENTORY_BY_ID = Object.fromEntries(
  PROCESSING_INVENTORY.map((activity) => [activity.id, activity]),
) as Record<string, ProcessingActivity>;

export const OPEN_LEGAL_BASIS_ACTIVITY_IDS = PROCESSING_INVENTORY
  .filter((activity) => activity.legalBasisState === "open")
  .map((activity) => activity.id);

export const OPEN_RETENTION_ACTIVITY_IDS = PROCESSING_INVENTORY
  .filter((activity) => activity.retentionState === "open")
  .map((activity) => activity.id);
