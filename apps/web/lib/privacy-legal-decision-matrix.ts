import { PROCESSING_INVENTORY } from "@/lib/privacy-processing-inventory";

export const LEGAL_DECISION_MATRIX_VERSION = "2026-10-04-lr3.2";

export type LegalBasisCode =
  | "art6-1-a-consent"
  | "art6-1-b-contract"
  | "art6-1-c-legal-obligation"
  | "art6-1-f-legitimate-interest"
  | "conditional-non-personal"
  | "tenant-controller-determined";

export type LegalDecisionState =
  | "adopted-internal-baseline"
  | "blocked-until-lr4"
  | "conditional-classification"
  | "tenant-controller-owned";

export type RetentionEnforcementState =
  | "policy-baseline-requires-implementation"
  | "provider-configuration-required"
  | "tenant-dpa-required"
  | "blocked-with-processing";

export type RightCode =
  | "access"
  | "rectification"
  | "erasure-subject-to-exceptions"
  | "restriction"
  | "portability-where-applicable"
  | "objection"
  | "withdraw-consent"
  | "complaint"
  | "tenant-controller-request-channel";

export type LegalDecision = {
  activityId: string;
  decisionState: LegalDecisionState;
  primaryBasis: LegalBasisCode;
  secondaryBases: LegalBasisCode[];
  basisRationale: string;
  legitimateInterestAssessmentRequired: boolean;
  noticePath: "art13" | "art14" | "art13-art14" | "processor-dpa";
  noticeTiming: string;
  retentionRule: string;
  retentionMaxDays: number | null;
  retentionTrigger: string;
  retentionExceptions: string[];
  retentionEnforcement: RetentionEnforcementState;
  rights: RightCode[];
  dsarOwner: "smart-steel-sales" | "tenant-controller";
  implementationGates: string[];
  professionalReviewRequired: boolean;
};

const CONTRACT_RIGHTS: RightCode[] = [
  "access",
  "rectification",
  "erasure-subject-to-exceptions",
  "restriction",
  "portability-where-applicable",
  "complaint",
];

const LEGITIMATE_INTEREST_RIGHTS: RightCode[] = [
  "access",
  "rectification",
  "erasure-subject-to-exceptions",
  "restriction",
  "objection",
  "complaint",
];

const CONSENT_RIGHTS: RightCode[] = [
  "access",
  "rectification",
  "erasure-subject-to-exceptions",
  "restriction",
  "portability-where-applicable",
  "withdraw-consent",
  "complaint",
];

/**
 * LR3.2 internal legal/retention decision baseline.
 *
 * It is deliberately implementation-oriented but is not a substitute for
 * professional legal review. "Adopted" means adopted as a product/compliance
 * baseline for engineering and notices. It does not mean external legal sign-off.
 *
 * Retention windows are maximum default policy targets. A documented legal hold,
 * dispute, statutory obligation, active security incident or data-subject request
 * can suspend deletion only for the affected records and for the necessary period.
 */
export const LEGAL_DECISION_MATRIX: LegalDecision[] = [
  {
    activityId: "LR3-A01",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-f-legitimate-interest",
    secondaryBases: [],
    basisRationale:
      "Security, abuse prevention and reliable delivery are necessary operational interests; the dataset must remain limited to technical/security data and pass a documented balancing test.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13",
    noticeTiming: "Public privacy notice available when the service request is made.",
    retentionRule:
      "Ordinary application/security logs: maximum 90 days. Records promoted into a documented security incident may be retained up to 24 months from incident closure.",
    retentionMaxDays: 90,
    retentionTrigger: "Event/log creation; incident evidence uses incident closure.",
    retentionExceptions: ["documented legal hold", "active security incident", "statutory obligation"],
    retentionEnforcement: "provider-configuration-required",
    rights: LEGITIMATE_INTEREST_RIGHTS,
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR6 provider log retention verification", "LR7 LIA/security playbook"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A02",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-b-contract",
    secondaryBases: ["art6-1-f-legitimate-interest"],
    basisRationale:
      "Account creation, authentication and recovery are necessary to provide the requested SaaS access; security signals are separately supported by the platform security interest.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13",
    noticeTiming: "At signup/account creation before the personal data are submitted.",
    retentionRule:
      "Core account/profile data: for the active account plus up to 30 days after closure/deletion workflow completion. Backup copies should age out within 90 days.",
    retentionMaxDays: 30,
    retentionTrigger: "Account closure or verified deletion request completion.",
    retentionExceptions: ["security/audit records governed by LR3-A11", "legal hold", "statutory obligation"],
    retentionEnforcement: "policy-baseline-requires-implementation",
    rights: CONTRACT_RIGHTS,
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR5 account deletion/export flow", "LR6 Supabase backup/retention verification"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A03",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-b-contract",
    secondaryBases: ["art6-1-f-legitimate-interest"],
    basisRationale:
      "The applicant asks Smart Steel Sales to evaluate and activate an organization. Duplicate/fraud/identity checks are separated as legitimate-interest controls.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13",
    noticeTiming: "Inline on the registration form before submission, with the full privacy notice linked.",
    retentionRule:
      "Unsubmitted drafts: 90 days from last activity. Rejected/withdrawn applications: 12 months from closure. Activated application/review evidence: 24 months from activation, then minimise/delete personal contact snapshots unless another rule applies.",
    retentionMaxDays: 730,
    retentionTrigger: "Draft last activity, application closure, or organization activation depending on state.",
    retentionExceptions: ["legal hold", "fraud/security investigation", "statutory obligation"],
    retentionEnforcement: "policy-baseline-requires-implementation",
    rights: Array.from(new Set([...CONTRACT_RIGHTS, "objection" as RightCode])),
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR5 registration notice/acceptance evidence", "retention jobs"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A04",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-b-contract",
    secondaryBases: ["art6-1-f-legitimate-interest"],
    basisRationale:
      "Direct claim data supports a requested claim/onboarding service; anti-fraud and identity-integrity checks rely on a separately documented legitimate interest. Any indirectly sourced personal data remains subject to LR4.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13-art14",
    noticeTiming:
      "Art. 13 at claim submission. If personal data were obtained indirectly, apply the LR4 Art. 14 rule before first disclosure/contact and no later than one month where applicable.",
    retentionRule:
      "Abandoned/denied claim evidence: 12 months from closure. Approved claim evidence: 24 months after the claim/control relationship ends.",
    retentionMaxDays: 730,
    retentionTrigger: "Claim closure or end of the approved control relationship.",
    retentionExceptions: ["fraud/security investigation", "legal hold", "statutory obligation"],
    retentionEnforcement: "policy-baseline-requires-implementation",
    rights: Array.from(new Set([...CONTRACT_RIGHTS, "objection" as RightCode])),
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR4 indirect-source governance", "LR5 claim notice", "retention jobs"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A05",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-f-legitimate-interest",
    secondaryBases: ["art6-1-b-contract"],
    basisRationale:
      "Before acceptance, an organization administrator supplies the invitee email to enable a requested team-access workflow; after acceptance, membership administration is part of service delivery.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13",
    noticeTiming:
      "Invitation email must contain first-layer privacy information/link; full account notice applies at signup/acceptance.",
    retentionRule:
      "Expired/revoked invitations: 90 days after terminal state. Accepted invitation delivery evidence: 12 months. Active membership data: for membership duration plus 30 days after removal, except audit records.",
    retentionMaxDays: 365,
    retentionTrigger: "Invitation terminal state or membership removal.",
    retentionExceptions: ["audit history governed by LR3-A11", "legal hold", "security investigation"],
    retentionEnforcement: "policy-baseline-requires-implementation",
    rights: Array.from(new Set([...LEGITIMATE_INTEREST_RIGHTS, "portability-where-applicable" as RightCode])),
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR5 invitation privacy notice", "invitation/member cleanup jobs"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A06",
    decisionState: "blocked-until-lr4",
    primaryBasis: "art6-1-f-legitimate-interest",
    secondaryBases: [],
    basisRationale:
      "For natural-person data sourced indirectly, legitimate interest is only a candidate basis. Processing beyond a quarantined governance review is blocked until LR4 documents purpose/necessity/balancing, source legitimacy, Art. 14 delivery and objection/removal handling.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art14",
    noticeTiming:
      "Before first public disclosure or first communication where those occur first; otherwise within a reasonable period and no later than one month after obtaining the personal data, subject only to a documented Art. 14 exception.",
    retentionRule:
      "Potential personal data that fail governance: delete/quarantine-clear within 30 days of rejection. If LR4 later authorizes person-linked publication, re-verify source/necessity at least every 12 months and define removal/audit retention in LR4 before enabling scale.",
    retentionMaxDays: 30,
    retentionTrigger: "Governance rejection for blocked data; approved publication remains disabled until LR4.",
    retentionExceptions: ["minimal evidence necessary to document a correction/removal decision, with separate retention"],
    retentionEnforcement: "blocked-with-processing",
    rights: LEGITIMATE_INTEREST_RIGHTS,
    dsarOwner: "smart-steel-sales",
    implementationGates: [
      "LR4 legitimate-interest assessment",
      "LR4 Art. 14 notice workflow",
      "LR4 source/provenance and objection/removal controls",
    ],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A07",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-a-consent",
    secondaryBases: [],
    basisRationale:
      "GA4 is optional public-site measurement and is loaded only after an explicit analytics choice; service access does not depend on consent.",
    legitimateInterestAssessmentRequired: false,
    noticePath: "art13",
    noticeTiming: "Before analytics is loaded, through the first-layer consent UI and linked cookie/privacy notices.",
    retentionRule:
      "Local consent evidence remains current for 6 months at an unchanged notice version. Configure GA4 user/event-level retention to the minimum available 2 months; LR6 must verify the production property and Google transfer settings.",
    retentionMaxDays: 183,
    retentionTrigger: "Consent decision for local evidence; GA4 event collection for provider data.",
    retentionExceptions: [],
    retentionEnforcement: "provider-configuration-required",
    rights: CONSENT_RIGHTS,
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR6 verify GA4 2-month retention", "LR6 transfer/DPA review"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A08",
    decisionState: "conditional-classification",
    primaryBasis: "conditional-non-personal",
    secondaryBases: ["art6-1-f-legitimate-interest"],
    basisRationale:
      "The application table intentionally stores no user/account identifier or commercial payload. If the stored dataset remains non-personal, GDPR legal basis is not required for that dataset; request/infrastructure metadata is governed separately by LR3-A01. Any future identifier addition reclassifies the activity and requires an LIA before release.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13",
    noticeTiming: "Public privacy notice describes privacy-minimal telemetry; re-notice is required before adding identifiers.",
    retentionRule:
      "Anonymous/minimal product-discovery events: maximum 12 months, then delete or aggregate irreversibly.",
    retentionMaxDays: 365,
    retentionTrigger: "Telemetry event creation.",
    retentionExceptions: [],
    retentionEnforcement: "policy-baseline-requires-implementation",
    rights: [],
    dsarOwner: "smart-steel-sales",
    implementationGates: ["retention cleanup job", "schema regression guard against identifiers"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A09",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-b-contract",
    secondaryBases: ["art6-1-f-legitimate-interest"],
    basisRationale:
      "Authenticated Network/Marketplace interactions are requested product functions; moderation, entitlement enforcement and anti-abuse controls are separate legitimate interests.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13",
    noticeTiming: "Before/at activation of Network or Marketplace features, with contextual notice for counterpart-visible actions.",
    retentionRule:
      "User-generated inquiry/interaction history: active service period plus 24 months after closure or terminal marketplace state. Pure follow/save state may be removed immediately on user action. Moderation/security evidence follows LR3-A11.",
    retentionMaxDays: 730,
    retentionTrigger: "Organization/account closure or terminal interaction state.",
    retentionExceptions: ["legal hold", "open dispute", "moderation/security evidence"],
    retentionEnforcement: "policy-baseline-requires-implementation",
    rights: Array.from(new Set([...CONTRACT_RIGHTS, "objection" as RightCode])),
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR8 SaaS/marketplace terms", "retention and export/delete workflow"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A10",
    decisionState: "tenant-controller-owned",
    primaryBasis: "tenant-controller-determined",
    secondaryBases: [],
    basisRationale:
      "The tenant determines purposes/legal basis for its imported commercial communications. Smart Steel Sales processes that tenant dataset on documented instructions and must provide Article 28 processor obligations and assistance.",
    legitimateInterestAssessmentRequired: false,
    noticePath: "processor-dpa",
    noticeTiming: "Governed by the tenant controller's notices and the Smart Steel Sales DPA/subprocessor disclosure.",
    retentionRule:
      "Tenant-configurable active retention. Product default on account/service termination: deletion/export window up to 30 days, followed by backup ageing out within 90 days unless a documented tenant/legal hold applies.",
    retentionMaxDays: 30,
    retentionTrigger: "Tenant deletion instruction or service termination.",
    retentionExceptions: ["tenant-documented legal hold", "backup ageing up to 90 days"],
    retentionEnforcement: "tenant-dpa-required",
    rights: ["tenant-controller-request-channel"],
    dsarOwner: "tenant-controller",
    implementationGates: ["LR6 subprocessor/transfer register", "LR8 DPA", "tenant export/delete controls"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A11",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-f-legitimate-interest",
    secondaryBases: ["art6-1-c-legal-obligation"],
    basisRationale:
      "Platform accountability, permission audit, fraud/security investigation and incident evidence are legitimate operational interests; a legal-obligation basis applies only where a concrete law requires the specific record or preservation.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13-art14",
    noticeTiming: "Covered in relevant Art. 13/14 notices; operator/admin activity is additionally covered by internal access policies.",
    retentionRule:
      "Governance/admin audit events: 24 months. Security incident evidence may be retained up to 36 months after incident closure when necessary and documented.",
    retentionMaxDays: 730,
    retentionTrigger: "Audit event creation; incident evidence uses incident closure.",
    retentionExceptions: ["documented legal hold", "statutory preservation duty", "active dispute"],
    retentionEnforcement: "policy-baseline-requires-implementation",
    rights: LEGITIMATE_INTEREST_RIGHTS,
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR7 audit/security retention jobs", "LR7 breach/DSAR playbook"],
    professionalReviewRequired: true,
  },
  {
    activityId: "LR3-A12",
    decisionState: "adopted-internal-baseline",
    primaryBasis: "art6-1-b-contract",
    secondaryBases: ["art6-1-f-legitimate-interest"],
    basisRationale:
      "Verification and operational service messages are necessary to provide or administer requested access. Invitation delivery before acceptance is aligned with the organization/team-access legitimate interest. Marketing is excluded.",
    legitimateInterestAssessmentRequired: true,
    noticePath: "art13",
    noticeTiming: "At account/registration collection; invitation recipients receive a privacy link in the first operational message.",
    retentionRule:
      "Internal delivery evidence and provider delivery logs: target maximum 90 days unless a shorter provider setting is available. Do not retain full message bodies solely for delivery logging.",
    retentionMaxDays: 90,
    retentionTrigger: "Message send/delivery event.",
    retentionExceptions: ["security investigation", "legal hold"],
    retentionEnforcement: "provider-configuration-required",
    rights: Array.from(new Set([...CONTRACT_RIGHTS, "objection" as RightCode])),
    dsarOwner: "smart-steel-sales",
    implementationGates: ["LR5 transactional-email notice", "LR6 provider retention/DPA verification"],
    professionalReviewRequired: true,
  },
];

export const LEGAL_DECISION_BY_ACTIVITY_ID = Object.fromEntries(
  LEGAL_DECISION_MATRIX.map((decision) => [decision.activityId, decision]),
) as Record<string, LegalDecision>;

export const PROCESSING_ACTIVITY_IDS = PROCESSING_INVENTORY.map((activity) => activity.id);

export const MISSING_LEGAL_DECISION_ACTIVITY_IDS = PROCESSING_ACTIVITY_IDS.filter(
  (id) => !LEGAL_DECISION_BY_ACTIVITY_ID[id],
);

export const BLOCKED_PROCESSING_ACTIVITY_IDS = LEGAL_DECISION_MATRIX
  .filter((decision) => decision.decisionState === "blocked-until-lr4")
  .map((decision) => decision.activityId);

export const LIA_REQUIRED_ACTIVITY_IDS = LEGAL_DECISION_MATRIX
  .filter((decision) => decision.legitimateInterestAssessmentRequired)
  .map((decision) => decision.activityId);
