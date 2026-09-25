import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type RegistrationQueueItem = {
  id: string;
  applicant_user_id: string;
  applicant_email: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  vat_id: string | null;
  primary_company_type: string;
  application_status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  activated_organization_id: string | null;
  matched_network_company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistrationEvent = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_type: string;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type RegistrationApplicationDetail = {
  id: string;
  applicant_user_id: string;
  applicant_email_snapshot: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  vat_id: string | null;
  registration_id: string | null;
  website_url: string | null;
  primary_company_type: string;
  secondary_company_types: string[];
  contact_name: string;
  contact_phone: string | null;
  short_description: string | null;
  application_status: string;
  submitted_at: string | null;
  email_verified_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason_code: string | null;
  rejection_note: string | null;
  activated_organization_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function isPlatformSuperadmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_superadmin");
  return !error && data === true;
}

export async function requirePlatformSuperadmin() {
  const allowed = await isPlatformSuperadmin();
  if (!allowed) redirect("/dashboard");
}

export async function getRegistrationQueue(status?: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p0a_admin_registration_queue", {
    p_status: status || null,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    count?: number;
    applications?: RegistrationQueueItem[];
  };

  return {
    count: Number(payload.count ?? 0),
    applications: payload.applications ?? [],
  };
}

export async function getRegistrationDetail(applicationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p0a_admin_registration_detail", {
    p_application_id: applicationId,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    return null;
  }

  const payload = data as {
    application?: RegistrationApplicationDetail;
    events?: RegistrationEvent[];
  };

  if (!payload?.application) return null;

  return {
    application: payload.application,
    events: payload.events ?? [],
  };
}


export type RegistrationNetworkCandidate = {
  network_company_id: string;
  legal_name: string;
  country_code: string;
  website_domain: string | null;
  publication_status: string;
  verification_status: string;
  signals: string[];
  match_score: number;
};

export async function getRegistrationNetworkCandidates(applicationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("m7_registration_network_candidates", {
    p_application_id: applicationId,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as { candidates?: RegistrationNetworkCandidate[] };
  return payload.candidates ?? [];
}
