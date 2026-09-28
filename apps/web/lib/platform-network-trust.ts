import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type NetworkTrustEvidence = {
  assertion_id: string;
  entity_type: string;
  verification_scope:
    | "company"
    | "facility"
    | "facility_capability"
    | "company_certification";
  target_id: string;
  target_label: string;
  field_path: string;
  asserted_value: unknown;
  source_type: string;
  source_reference: string;
  ownership_type: string;
  confidence: number | null;
  review_state: string;
  captured_at: string;
  target_verification_status: string | null;
};

export type NetworkTrustVerification = {
  verification_id: string;
  scope: string;
  target_id: string;
  target_label: string;
  status: string;
  evidence_assertion_id: string;
  evidence_field_path: string | null;
  evidence_source_type: string | null;
  evidence_source_reference: string | null;
  verified_by: string;
  verified_at: string;
  expires_at: string | null;
  note: string | null;
};

export type NetworkTrustChangeReview = {
  review_id: string;
  network_company_id: string;
  company_legal_name: string;
  assertion_id: string;
  field_path: string;
  previous_value: unknown;
  proposed_value: unknown;
  status: string;
  opened_by: string;
  opened_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  source_type: string;
  source_reference: string;
  ownership_type: string;
  assertion_review_state: string;
};

export type NetworkTrustIdentityCandidate = {
  candidate_id: string;
  company_a_id: string;
  company_a_legal_name: string;
  company_a_domain: string | null;
  company_b_id: string;
  company_b_legal_name: string;
  company_b_domain: string | null;
  signals: string[];
  match_score: number;
  status: string;
  is_active: boolean;
  generated_at: string;
  last_evaluated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export type NetworkTrustQueue = {
  counts: {
    accepted_evidence: number;
    current_verifications: number;
    open_change_reviews: number;
    open_identity_candidates: number;
    unverified_companies: number;
  };
  evidence: NetworkTrustEvidence[];
  current_verifications: NetworkTrustVerification[];
  change_reviews: NetworkTrustChangeReview[];
  identity_candidates: NetworkTrustIdentityCandidate[];
};

export async function getNetworkTrustQueue(): Promise<NetworkTrustQueue> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa8_network_trust_queue", {
    p_limit: 150,
  });

  if (error) {
    if (error.code === "42501") redirect("/platform");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as Partial<NetworkTrustQueue>;
  return {
    counts: {
      accepted_evidence: Number(payload.counts?.accepted_evidence ?? 0),
      current_verifications: Number(payload.counts?.current_verifications ?? 0),
      open_change_reviews: Number(payload.counts?.open_change_reviews ?? 0),
      open_identity_candidates: Number(
        payload.counts?.open_identity_candidates ?? 0,
      ),
      unverified_companies: Number(payload.counts?.unverified_companies ?? 0),
    },
    evidence: payload.evidence ?? [],
    current_verifications: payload.current_verifications ?? [],
    change_reviews: payload.change_reviews ?? [],
    identity_candidates: payload.identity_candidates ?? [],
  };
}
