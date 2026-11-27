export type DescriptionAssistantDecision = "accepted" | "edited" | "ignored";

export type DescriptionAssistantProposal = {
  hash: string;
  summaryHash: string;
  description: string;
  sourceUrls: string[];
  observedAt: string | null;
  extractorVersion: string | null;
};

export type DescriptionAssistantReview = {
  networkCompanyId: string;
  currentDescription: string | null;
  currentDescriptionHash: string;
  availability:
    | "available"
    | "no_research"
    | "no_summary"
    | "source_mismatch"
    | "already_current"
    | "already_decided"
    | "unavailable";
  proposal: DescriptionAssistantProposal | null;
  decision: { action: DescriptionAssistantDecision; decidedAt: string } | null;
};

export type DescriptionAssistantActionState = {
  status: "idle" | DescriptionAssistantDecision | "stale" | "error";
  message: string;
  description?: string | null;
  descriptionHash?: string;
  changed?: boolean;
};

const contract = "company-ux2c1-description-v1";
const fingerprint = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const availability = new Set([
  "available", "no_research", "no_summary", "source_mismatch", "already_current", "already_decided",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isDecision(value: unknown): value is DescriptionAssistantDecision {
  return value === "accepted" || value === "edited" || value === "ignored";
}

export function isDescriptionFingerprint(value: unknown): value is string {
  return typeof value === "string" && fingerprint.test(value);
}

/** Source links are evidence to inspect, never executable or credential-bearing URLs. */
export function descriptionSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function parseDescriptionAssistantReview(
  value: unknown,
  companyId: string,
): DescriptionAssistantReview | null {
  const data = record(value);
  if (!data || data.contract !== contract || data.network_company_id !== companyId
    || !isDescriptionFingerprint(data.current_description_hash)
    || !(data.current_description === null || typeof data.current_description === "string")
    || typeof data.availability !== "string" || !availability.has(data.availability)) return null;

  let proposal: DescriptionAssistantProposal | null = null;
  if (data.proposal !== null) {
    const candidate = record(data.proposal);
    if (!candidate || !isDescriptionFingerprint(candidate.hash)
      || !isDescriptionFingerprint(candidate.summary_hash)
      || typeof candidate.description !== "string" || !candidate.description.trim()
      || candidate.description.length > 4000 || !Array.isArray(candidate.source_urls)
      || candidate.source_urls.length < 1 || candidate.source_urls.length > 12) return null;
    const sourceUrls = candidate.source_urls.map(descriptionSourceUrl);
    if (sourceUrls.some((url) => url === null)) return null;
    proposal = {
      hash: candidate.hash,
      summaryHash: candidate.summary_hash,
      description: candidate.description,
      sourceUrls: [...new Set(sourceUrls as string[])],
      observedAt: typeof candidate.observed_at === "string" ? candidate.observed_at : null,
      extractorVersion: typeof candidate.extractor_version === "string" ? candidate.extractor_version : null,
    };
  }

  let decision: DescriptionAssistantReview["decision"] = null;
  if (data.decision !== null) {
    const saved = record(data.decision);
    if (!saved || !isDecision(saved.action) || typeof saved.decided_at !== "string") return null;
    decision = { action: saved.action, decidedAt: saved.decided_at };
  }
  if (["available", "already_current", "already_decided"].includes(data.availability) && !proposal) return null;
  if (data.availability === "already_decided" && !decision) return null;

  return {
    networkCompanyId: companyId,
    currentDescription: data.current_description,
    currentDescriptionHash: data.current_description_hash,
    availability: data.availability as DescriptionAssistantReview["availability"],
    proposal,
    decision,
  };
}

export function descriptionDecisionInput(formData: FormData) {
  const companyId = String(formData.get("network_company_id") ?? "").trim();
  const proposalHash = String(formData.get("expected_proposal_hash") ?? "").trim();
  const descriptionHash = String(formData.get("expected_description_hash") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!uuid.test(companyId) || !isDescriptionFingerprint(proposalHash)
    || !isDescriptionFingerprint(descriptionHash)
    || !(decision === "accept" || decision === "edit" || decision === "ignore")) return null;
  if (decision === "edit" && (description.length < 1 || description.length > 4000)) return null;
  return { companyId, proposalHash, descriptionHash, decision, description: decision === "edit" ? description : null };
}

export function parseDescriptionAssistantDecision(value: unknown) {
  const data = record(value);
  if (!data || data.contract !== contract || !isDecision(data.decision)
    || !isDescriptionFingerprint(data.description_hash)
    || !(data.description === null || typeof data.description === "string")
    || typeof data.changed !== "boolean") return null;
  return { decision: data.decision, description: data.description, descriptionHash: data.description_hash, changed: data.changed };
}
