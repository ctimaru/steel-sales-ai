import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CompanyDiscoveryEvidence = {
  url: string;
  title?: string | null;
  snippet?: string | null;
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
  };

  return {
    items: payload.items ?? [],
    total: Number(payload.total ?? 0),
    limit: Number(payload.limit ?? 150),
  };
}
