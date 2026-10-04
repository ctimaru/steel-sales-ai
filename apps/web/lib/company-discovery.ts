import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CompanyDiscoveryEvidence = {
  url: string;
  title?: string | null;
  snippet?: string | null;
};

export type CompanyDiscoveryFacilityCandidate = {
  name: string | null;
  facility_type: string;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country_code: string;
  website_url: string | null;
  source_url: string;
  source_kind?: string;
};

export type CompanyDiscoveryCandidate = {
  id: string;
  run_id: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  website_url: string;
  canonical_domain: string;
  description: string | null;
  role_keys: string[];
  subtype_keys: string[];
  product_relations: { key: string; relationship_type: string }[];
  evidence: CompanyDiscoveryEvidence[];
  source_urls: string[];
  match_company_id: string | null;
  match_signals: string[];
  confidence: number;
  extraction_version: string;
  identity_quality: Record<string, unknown>;
  classification_scores: Record<string, number>;
  quality_flags: string[];
  facility_candidates: CompanyDiscoveryFacilityCandidate[];
  capability_keys: string[];
  market_keys: string[];
  enrichment_quality: Record<string, unknown>;
  review_status: string;
  reviewed_at: string | null;
  review_note: string | null;
  promoted_company_id: string | null;
  created_at: string;
};

export async function getCompanyDiscoveryQueue(status?: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p3_admin_discovery_queue", {
    p_status: status || null,
    p_limit: 150,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    items?: CompanyDiscoveryCandidate[];
    total?: number;
    limit?: number;
    quality?: {
      flagged?: number;
      exact_identity_matches?: number;
      enrichment_ready?: number;
    };
  };

  return {
    items: payload.items ?? [],
    total: Number(payload.total ?? 0),
    limit: Number(payload.limit ?? 150),
    quality: {
      flagged: Number(payload.quality?.flagged ?? 0),
      exact_identity_matches: Number(payload.quality?.exact_identity_matches ?? 0),
      enrichment_ready: Number(payload.quality?.enrichment_ready ?? 0),
    },
  };
}

export type CompanyDiscoveryRun = {
  id: string;
  label: string | null;
  source_type: string;
  source_reference: string | null;
  country_code: string;
  status: string;
  seed_count: number;
  candidate_count: number;
  skipped_count: number;
  error_count: number;
  exact_match_count: number;
  extraction_version: string;
  stats: Record<string, unknown>;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export async function getCompanyDiscoveryRuns(): Promise<CompanyDiscoveryRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p3_admin_discovery_runs", {
    p_limit: 12,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  return Array.isArray(data) ? (data as CompanyDiscoveryRun[]) : [];
}


export type DiscoveryRunGovernance = {
  run_id: string;
  governance_status: "unreviewed" | "approved" | "restricted" | "blocked";
  terms_status:
    | "not_checked"
    | "allows_reuse"
    | "allows_limited_reuse"
    | "restricts_reuse"
    | "unknown";
  database_rights_status:
    | "not_assessed"
    | "low_risk"
    | "licensed"
    | "restricted"
    | "unknown";
  personal_data_policy:
    | "not_assessed"
    | "company_data_only"
    | "exclude_personal_data"
    | "legal_review_required";
  governance_reviewed_at: string | null;
  governance_note: string | null;
  created_at: string;
};

export type DiscoveryCandidateGovernance = {
  candidate_id: string;
  run_id: string;
  governance_status:
    | "unreviewed"
    | "approved_company_data"
    | "needs_legal_review"
    | "blocked";
  personal_data_detected: boolean;
  personal_data_fields: string[];
  governance_reviewed_at: string | null;
  governance_note: string | null;
  publication_gate_ready: boolean;
  created_at: string;
};

export type DiscoveryGovernanceState = {
  runs: DiscoveryRunGovernance[];
  candidates: DiscoveryCandidateGovernance[];
  summary: {
    source_review_required: number;
    candidate_review_required: number;
    publication_ready: number;
  };
};

export async function getCompanyDiscoveryGovernance(): Promise<DiscoveryGovernanceState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pa1_5_discovery_governance_state", {
    p_limit: 300,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as Partial<DiscoveryGovernanceState>;
  return {
    runs: payload.runs ?? [],
    candidates: payload.candidates ?? [],
    summary: {
      source_review_required: Number(payload.summary?.source_review_required ?? 0),
      candidate_review_required: Number(payload.summary?.candidate_review_required ?? 0),
      publication_ready: Number(payload.summary?.publication_ready ?? 0),
    },
  };
}

export type CompanyDataGovernanceRequest = {
  id: string;
  request_type: "correction" | "removal" | "source_question";
  company_name: string;
  country_code: string | null;
  contact_email: string | null;
  source_url: string | null;
  request_text: string;
  status: "received" | "in_review" | "resolved" | "rejected";
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export async function getCompanyDataGovernanceRequests() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pa1_5_company_data_request_queue", {
    p_status: null,
    p_limit: 100,
  });

  if (error) {
    if (error.code === "42501") return { items: [], open_count: 0 };
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    items?: CompanyDataGovernanceRequest[];
    open_count?: number;
  };

  return {
    items: payload.items ?? [],
    open_count: Number(payload.open_count ?? 0),
  };
}
