import { descriptionSourceUrl, isDescriptionFingerprint } from "@/lib/company-description-assistant";

export type IndustrialKind = "product" | "capability" | "market" | "certification";
export type IndustrialGroup = "products" | "capabilities" | "markets" | "certifications";
export type IndustrialSelection = {
  key: string;
  relationship_type?: string;
  facility_id?: string | null;
};
export type IndustrialEffect = "added" | "already_present" | "ignored";
export type IndustrialProposal = {
  kind: IndustrialKind;
  contentKey: string;
  hash: string;
  label: string;
  suggestedKey: string | null;
  sourceUrls: string[];
  observedAt: string | null;
  extractorVersion: string | null;
  decision: null | {
    action: "confirmed" | "ignored";
    effect: IndustrialEffect;
    decidedAt: string;
    targetId: string | null;
    selection: IndustrialSelection | null;
  };
};
export type IndustrialReview = {
  networkCompanyId: string;
  availability: "available" | "empty" | "no_research" | "source_mismatch" | "unavailable";
  sourceUrls: string[];
  observedAt: string | null;
  extractorVersion: string | null;
  stateHashes: Record<IndustrialGroup, string>;
  proposals: IndustrialProposal[];
};
export type IndustrialActionState = {
  status: "idle" | "confirmed" | "ignored" | "already_present" | "stale" | "error";
  message: string;
  contentKey?: string;
  targetId?: string | null;
  selection?: IndustrialSelection | null;
  changed?: boolean;
  stateHash?: string;
};

const contract = "company-ux2c2-industrial-v1";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const canonicalKey = /^[a-z][a-z0-9_]{0,79}$/;
const relationships = new Set(["produces", "distributes", "stocks", "processes", "uses"]);
const groups: Record<IndustrialKind, IndustrialGroup> = {
  product: "products", capability: "capabilities", market: "markets", certification: "certifications",
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function nullableText(value: unknown, maximum: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maximum);
}
function sourceUrls(value: unknown, required = false): string[] | null {
  if (!Array.isArray(value) || value.length > 12 || (required && value.length === 0)) return null;
  const urls = value.map(descriptionSourceUrl);
  return urls.some((url) => url === null) ? null : [...new Set(urls as string[])];
}
export function isIndustrialKind(value: unknown): value is IndustrialKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(groups, value);
}
export function industrialGroup(kind: IndustrialKind): IndustrialGroup {
  return groups[kind];
}

/** Capability anchors use the facility ID, not the capability relation ID. */
export function industrialTargetHref(kind: IndustrialKind, anchorId?: string | null): string {
  const panel = kind === "capability" ? "facilities" : groups[kind];
  return "#" + panel + (anchorId && uuid.test(anchorId) ? "-item-" + anchorId : "");
}

function parseSelection(kind: IndustrialKind, value: unknown): IndustrialSelection | null {
  const data = record(value);
  if (!data || typeof data.key !== "string" || !canonicalKey.test(data.key)) return null;
  const allowed = kind === "product" ? ["key", "relationship_type", "facility_id"]
    : kind === "market" ? ["key"] : ["key", "facility_id"];
  if (Object.keys(data).some((key) => !allowed.includes(key))) return null;
  if (kind !== "market" && !(data.facility_id === null || (typeof data.facility_id === "string" && uuid.test(data.facility_id)))) return null;
  if (kind === "capability" && data.facility_id === null) return null;
  if (kind === "product" && (typeof data.relationship_type !== "string" || !relationships.has(data.relationship_type))) return null;
  return {
    key: data.key,
    ...(kind === "product" ? { relationship_type: data.relationship_type as string } : {}),
    ...(kind !== "market" ? { facility_id: data.facility_id as string | null } : {}),
  };
}

/** The database owns proposals and mappings; no client-provided label is saved. */
export function industrialDecisionInput(formData: FormData) {
  const companyId = String(formData.get("network_company_id") ?? "").trim();
  const kind = formData.get("kind");
  const contentKey = String(formData.get("content_key") ?? "");
  const proposalHash = String(formData.get("expected_proposal_hash") ?? "");
  const stateHash = String(formData.get("expected_state_hash") ?? "");
  const action = formData.get("decision");
  if (!uuid.test(companyId) || !isIndustrialKind(kind) || !isDescriptionFingerprint(contentKey)
    || !isDescriptionFingerprint(proposalHash) || !isDescriptionFingerprint(stateHash)
    || (action !== "confirm" && action !== "ignore")) return null;
  if (action === "ignore") return { companyId, kind, contentKey, proposalHash, stateHash, action, selection: null };

  const scope = formData.get("facility_id");
  if (kind !== "market" && (typeof scope !== "string" || (scope !== "company" && !uuid.test(scope)))) return null;
  const selection = parseSelection(kind, {
    key: String(formData.get("canonical_key") ?? "").trim(),
    ...(kind === "product" ? { relationship_type: String(formData.get("relationship_type") ?? "") } : {}),
    ...(kind !== "market" ? { facility_id: scope === "company" ? null : scope } : {}),
  });
  return selection ? { companyId, kind, contentKey, proposalHash, stateHash, action, selection } : null;
}

export function parseIndustrialReview(value: unknown, companyId: string): IndustrialReview | null {
  const data = record(value);
  if (!data || data.contract !== contract || data.network_company_id !== companyId
    || !["available", "empty", "no_research", "source_mismatch"].includes(String(data.availability))
    || !nullableText(data.observed_at, 100) || !nullableText(data.extractor_version, 256)
    || !Array.isArray(data.proposals) || data.proposals.length > 56) return null;
  const hashes = record(data.state_hashes);
  if (!hashes || Object.values(groups).some((group) => !isDescriptionFingerprint(hashes[group]))) return null;
  const sources = sourceUrls(data.source_urls, data.availability === "available");
  if (!sources) return null;

  const proposals: IndustrialProposal[] = [];
  const keys = new Set<string>();
  for (const item of data.proposals) {
    const row = record(item);
    if (!row || !isIndustrialKind(row.kind) || !isDescriptionFingerprint(row.content_key)
      || keys.has(row.content_key) || !isDescriptionFingerprint(row.proposal_hash)
      || typeof row.label !== "string" || row.label.trim().length < 2 || row.label.length > 80
      || /[@/<>]|https?:|www\./i.test(row.label)
      || !(row.suggested_key === null || (typeof row.suggested_key === "string" && canonicalKey.test(row.suggested_key)))
      || !nullableText(row.observed_at, 100) || !nullableText(row.extractor_version, 256)) return null;
    const proposalSources = sourceUrls(row.source_urls, true);
    if (!proposalSources) return null;
    let decision: IndustrialProposal["decision"] = null;
    if (row.decision !== null) {
      const saved = record(row.decision);
      if (!saved || (saved.action !== "confirmed" && saved.action !== "ignored")
        || !["added", "already_present", "ignored"].includes(String(saved.effect))
        || typeof saved.decided_at !== "string" || !Number.isFinite(Date.parse(saved.decided_at))
        || !(saved.target_id === null || (typeof saved.target_id === "string" && uuid.test(saved.target_id)))) return null;
      const selection = saved.action === "confirmed" ? parseSelection(row.kind, saved.selection) : null;
      if (saved.action === "confirmed" && (!selection || saved.effect === "ignored" || saved.target_id === null)) return null;
      if (saved.action === "ignored" && (saved.selection !== null || saved.target_id !== null || saved.effect !== "ignored")) return null;
      decision = {
        action: saved.action, effect: saved.effect as IndustrialEffect, decidedAt: saved.decided_at,
        targetId: saved.target_id as string | null, selection,
      };
    }
    keys.add(row.content_key);
    proposals.push({
      kind: row.kind, contentKey: row.content_key, hash: row.proposal_hash, label: row.label,
      suggestedKey: row.suggested_key as string | null, sourceUrls: proposalSources,
      observedAt: row.observed_at, extractorVersion: row.extractor_version, decision,
    });
  }
  if ((data.availability === "available") !== (proposals.length > 0)) return null;
  return {
    networkCompanyId: companyId, availability: data.availability as IndustrialReview["availability"],
    sourceUrls: sources, observedAt: data.observed_at, extractorVersion: data.extractor_version,
    stateHashes: hashes as Record<IndustrialGroup, string>, proposals,
  };
}

export function parseIndustrialDecision(value: unknown): null | {
  decision: "confirmed" | "ignored";
  effect: IndustrialEffect;
  changed: boolean;
  idempotent: boolean;
  targetId: string | null;
  stateHash: string;
} {
  const data = record(value);
  if (!data || data.contract !== contract || (data.decision !== "confirmed" && data.decision !== "ignored")
    || !["added", "already_present", "ignored"].includes(String(data.effect))
    || typeof data.changed !== "boolean" || typeof data.idempotent !== "boolean"
    || !isDescriptionFingerprint(data.state_hash) || typeof data.decision_id !== "string" || !uuid.test(data.decision_id)
    || !(data.target_id === null || (typeof data.target_id === "string" && uuid.test(data.target_id)))) return null;
  if (data.decision === "ignored" && (data.effect !== "ignored" || data.changed || data.target_id !== null)) return null;
  if (data.decision === "confirmed" && (data.effect === "ignored" || data.target_id === null)) return null;
  if ((data.effect === "already_present" || data.idempotent) && data.changed) return null;
  return {
    decision: data.decision, effect: data.effect as IndustrialEffect, changed: data.changed,
    idempotent: data.idempotent, targetId: data.target_id as string | null, stateHash: data.state_hash,
  };
}
