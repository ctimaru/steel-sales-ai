import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CompanyClaimState = {
  claim_id: string;
  network_company_id: string;
  organization_id: string;
  status: string;
  proof_method: string;
  proof_status: string;
  proof_reference: string | null;
  proof_review_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

export type CompanyClaimExperience = {
  network_company_id: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  website_domain: string | null;
  publication_status: string;
  claimed_status: string;
  verification_status: string;
  organization_id: string;
  organization_name: string;
  eligible: boolean;
  eligibility_reason:
    | "eligible"
    | "company_not_published"
    | "already_managed"
    | "already_claimed"
    | "organization_already_controls_profile"
    | "claim_in_progress";
  proof_path: "automatic_corporate_email" | "manual_review";
  proof_reason:
    | "unique_company_domain_match"
    | "email_not_confirmed"
    | "company_domain_missing"
    | "email_domain_missing"
    | "email_domain_mismatch"
    | "company_domain_shared"
    | "manual_review_required";
  automatic_ownership_proof_available: boolean;
  corporate_email_confirmed: boolean;
  email_domain_matches_company: boolean;
  company_domain_profile_count: number;
  current_claim: CompanyClaimState | null;
  claim_is_separate_from_network_verification: boolean;
};

export type AdminCompanyClaimItem = CompanyClaimState & {
  request_note: string | null;
  company_legal_name: string;
  website_domain: string | null;
  claimed_status: string;
  verification_status: string;
  organization_name: string;
};

export async function getCompanyClaimExperience(
  networkCompanyId: string,
  organizationId: string,
): Promise<CompanyClaimExperience> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hp5_company_claim_experience", {
    p_network_company_id: networkCompanyId,
    p_organization_id: organizationId,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  return data as CompanyClaimExperience;
}

export async function getMyCompanyClaim(
  networkCompanyId: string,
  organizationId: string,
): Promise<CompanyClaimState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p3_6_my_company_claim", {
    p_network_company_id: networkCompanyId,
    p_organization_id: organizationId,
  });

  if (error) {
    if (error.code === "42501") return null;
    throw new Error(error.message);
  }

  return (data as CompanyClaimState | null) ?? null;
}

export async function getAdminCompanyClaimQueue(status?: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p3_6_admin_claim_queue", {
    p_status: status || null,
    p_limit: 150,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    items?: AdminCompanyClaimItem[];
    total?: number;
    proof_pending?: number;
    proof_verified?: number;
  };

  return {
    items: payload.items ?? [],
    total: Number(payload.total ?? 0),
    proofPending: Number(payload.proof_pending ?? 0),
    proofVerified: Number(payload.proof_verified ?? 0),
  };
}
