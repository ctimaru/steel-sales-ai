/**
 * SP1 — Steel Pulse source-governance contract.
 * Research is NOT permission. Every initial source is disabled for automation.
 * SP2 ingestion and SP3 publication MUST call the guards below, and persist
 * approved decisions in a role-scoped, append-only audit store.
 */
export type SteelPulseSourceStatus = "candidate" | "approved" | "suspended" | "prohibited";
export type SteelPulseSourceOperation =
  | "discover_metadata"
  | "ingest_statistical_data"
  | "summarize_facts"
  | "publish_news_card"
  | "reuse_media";

export type SteelPulseLicenseBasis =
  | "unverified"
  | "verified_open_license"
  | "verified_public_reuse"
  | "explicit_written_agreement";

export type SteelPulseSource = {
  id: string;
  displayName: string;
  originUrl: string;
  allowedHosts: readonly string[];
  policyUrl: string | null;
  checkedOn: string;
  status: SteelPulseSourceStatus;
  channel: "official_api" | "publication" | "press_room" | "editorial_site";
  licenseBasis: SteelPulseLicenseBasis;
  approvedOperations: readonly SteelPulseSourceOperation[];
  reviewedBy: string | null;
  legalApprovedBy: string | null;
  approvalEvidenceUrl: string | null;
  approvedAt: string | null;
  approvalExpiresAt: string | null;
  notes: string;
};

export type SteelPulseActionContext = {
  now: Date;
  itemUrl: string;
  /** Mandatory for automated fetches. Never infer these from an RSS URL alone. */
  robotsAndTermsChecked?: boolean;
  rateLimitApproved?: boolean;
  /** Publication and adaptation require a verifiable item-level rights review. */
  itemRightsVerified?: boolean;
  attributionReady?: boolean;
  editorialApproved?: boolean;
  noThirdPartyMedia?: boolean;
  privacyReviewed?: boolean;
};

export type SteelPulsePermission = { allowed: true } | { allowed: false; reason: string };

// Strictly research-only seed data. These statuses MUST NOT be auto-promoted.
export const STEEL_PULSE_SOURCES: readonly SteelPulseSource[] = [
  {
    id: "eurostat",
    displayName: "Eurostat",
    originUrl: "https://ec.europa.eu/eurostat/",
    allowedHosts: ["ec.europa.eu"],
    policyUrl: "https://ec.europa.eu/eurostat/help/copyright-notice",
    checkedOn: "2026-10-08",
    status: "candidate",
    channel: "official_api",
    licenseBasis: "unverified",
    approvedOperations: [],
    reviewedBy: null,
    legalApprovedBy: null,
    approvalEvidenceUrl: null,
    approvedAt: null,
    approvalExpiresAt: null,
    notes: "General commercial reuse with attribution; assess specific dataset, third-party exceptions, and API terms before approval.",
  },
  {
    id: "oecd",
    displayName: "OECD",
    originUrl: "https://www.oecd.org/",
    allowedHosts: ["www.oecd.org", "oecd.org"],
    policyUrl: "https://www.oecd.org/en/about/terms-conditions.html",
    checkedOn: "2026-10-08",
    status: "candidate",
    channel: "publication",
    licenseBasis: "unverified",
    approvedOperations: [],
    reviewedBy: null,
    legalApprovedBy: null,
    approvalEvidenceUrl: null,
    approvedAt: null,
    approvalExpiresAt: null,
    notes: "Much post-2024 written content is CC BY 4.0, not all assets; per-item license and third-party rights check required.",
  },
  {
    id: "worldsteel",
    displayName: "World Steel Association",
    originUrl: "https://worldsteel.org/",
    allowedHosts: ["worldsteel.org", "www.worldsteel.org"],
    policyUrl: "https://worldsteel.org/global/copyright/",
    checkedOn: "2026-10-08",
    status: "candidate",
    channel: "press_room",
    licenseBasis: "unverified",
    approvedOperations: [],
    reviewedBy: null,
    legalApprovedBy: null,
    approvalEvidenceUrl: null,
    approvedAt: null,
    approvalExpiresAt: null,
    notes: "Attributed quotations mentioned in site terms; no blanket right to crawl, mirror releases, or use image-library assets commercially.",
  },
  {
    id: "eurofer",
    displayName: "EUROFER",
    originUrl: "https://www.eurofer.eu/",
    allowedHosts: ["www.eurofer.eu", "eurofer.eu"],
    policyUrl: null,
    checkedOn: "2026-10-08",
    status: "candidate",
    channel: "press_room",
    licenseBasis: "unverified",
    approvedOperations: [],
    reviewedBy: null,
    legalApprovedBy: null,
    approvalEvidenceUrl: null,
    approvedAt: null,
    approvalExpiresAt: null,
    notes: "Publisher authorization, automated-access terms and reusable content rights not yet established.",
  },
  {
    id: "siderweb",
    displayName: "siderweb",
    originUrl: "https://www.siderweb.com/",
    allowedHosts: ["www.siderweb.com", "siderweb.com"],
    policyUrl: null,
    checkedOn: "2026-10-08",
    status: "candidate",
    channel: "editorial_site",
    licenseBasis: "unverified",
    approvedOperations: [],
    reviewedBy: null,
    legalApprovedBy: null,
    approvalEvidenceUrl: null,
    approvedAt: null,
    approvalExpiresAt: null,
    notes: "No publication license verified. Seek written editorial partnership before automated acquisition or reuse.",
  },
  {
    id: "steelorbis",
    displayName: "SteelOrbis",
    originUrl: "https://www.steelorbis.com/",
    allowedHosts: ["www.steelorbis.com", "steelorbis.com"],
    policyUrl: "https://www.steelorbis.com/support/terms-of-use.htm",
    checkedOn: "2026-10-08",
    status: "prohibited",
    channel: "editorial_site",
    licenseBasis: "unverified",
    approvedOperations: [],
    reviewedBy: null,
    legalApprovedBy: null,
    approvalEvidenceUrl: null,
    approvedAt: null,
    approvalExpiresAt: null,
    notes: "Site terms restrict commercial use, reuse, redistribution and linking; no integration without express written agreement.",
  },
] as const;

export function isSteelPulseSourceUrlAllowed(source: SteelPulseSource, rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.port === "" &&
      source.allowedHosts.includes(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

/**
 * No action may run just because a source offers RSS/API or an open-license homepage.
 * The service must perform redirect/robots/rate checks at fetch time as well (SP2).
 */
export function authorizeSteelPulseAction(
  source: SteelPulseSource | undefined,
  operation: SteelPulseSourceOperation,
  context: SteelPulseActionContext,
): SteelPulsePermission {
  const deny = (reason: string): SteelPulsePermission => ({ allowed: false, reason });
  if (!source) return deny("unknown_source");
  if (source.status !== "approved") return deny("source_not_approved");
  if (!source.approvedOperations.includes(operation)) return deny("operation_not_licensed");
  if (!source.policyUrl || !source.approvalEvidenceUrl) return deny("rights_evidence_missing");
  if (!source.reviewedBy || !source.legalApprovedBy || !source.approvedAt || !source.approvalExpiresAt) {
    return deny("approval_incomplete");
  }
  const start = Date.parse(source.approvedAt);
  const end = Date.parse(source.approvalExpiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > context.now.getTime() || end <= context.now.getTime()) {
    return deny("approval_expired_or_invalid");
  }
  if (source.licenseBasis === "unverified") return deny("unverified_license");
  if (!isSteelPulseSourceUrlAllowed(source, context.itemUrl)) return deny("url_not_allowlisted");

  if (operation === "discover_metadata" || operation === "ingest_statistical_data" || operation === "summarize_facts") {
    if (!context.robotsAndTermsChecked || !context.rateLimitApproved) return deny("fetch_controls_missing");
  }
  if (operation === "ingest_statistical_data" || operation === "summarize_facts" || operation === "publish_news_card" || operation === "reuse_media") {
    if (!context.itemRightsVerified) return deny("item_rights_not_verified");
  }
  if (operation === "publish_news_card") {
    if (!context.attributionReady || !context.editorialApproved || !context.privacyReviewed || !context.noThirdPartyMedia) {
      return deny("editorial_privacy_or_attribution_gate_missing");
    }
  }
  // Image rights are independent from the textual article's rights.
  if (operation === "reuse_media" && !context.editorialApproved) return deny("media_approval_missing");
  return { allowed: true };
}

/**
 * SP2+: Decisions must be recorded in a private, immutable ledger with reviewer,
 * licensing evidence, timestamp, previous state, next state and revoke reason.
 * A mutable UI-only status is not sufficient authorization.
 */
export type SteelPulseSourceDecision = {
  sourceId: string;
  previousStatus: SteelPulseSourceStatus;
  nextStatus: SteelPulseSourceStatus;
  decidedAt: string;
  decidedBy: string;
  rightsEvidenceUrl: string;
  rationale: string;
  action: "approve" | "suspend" | "revoke";
};
