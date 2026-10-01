import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CompanySetupState = {
  organization_id: string;
  organization_name: string;
  role: string;
  onboarding_status: string;
  first_workspace_seen_at: string | null;
  guided_setup_completed_at: string | null;
  first_value_at: string | null;
  profile_ready: boolean;
  data_ready: boolean;
  team_ready: boolean;
  first_value_ready: boolean;
  commercial_memory_ready: boolean;
  network_company_id: string | null;
  member_count: number;
  source_preferences: string[];
  consent_accepted_at: string | null;
  essential_completed_count: number;
  essential_total_count: number;
  essential_completion_percentage: number;
  setup_completed: boolean;
  time_to_setup_seconds: number | null;
  time_to_first_value_seconds: number | null;
  time_from_first_workspace_to_value_seconds: number | null;
};

export async function getCompanySetupState(
  organizationId: string,
): Promise<CompanySetupState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hp7_company_setup_state", {
    p_organization_id: organizationId,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as Partial<CompanySetupState>;

  return {
    organization_id: payload.organization_id ?? organizationId,
    organization_name: payload.organization_name ?? "Workspace azienda",
    role: payload.role ?? "member",
    onboarding_status: payload.onboarding_status ?? "not_started",
    first_workspace_seen_at: payload.first_workspace_seen_at ?? null,
    guided_setup_completed_at: payload.guided_setup_completed_at ?? null,
    first_value_at: payload.first_value_at ?? null,
    profile_ready: payload.profile_ready === true,
    data_ready: payload.data_ready === true,
    team_ready: payload.team_ready === true,
    first_value_ready: payload.first_value_ready === true,
    commercial_memory_ready: payload.commercial_memory_ready === true,
    network_company_id: payload.network_company_id ?? null,
    member_count: Number(payload.member_count ?? 0),
    source_preferences: payload.source_preferences ?? [],
    consent_accepted_at: payload.consent_accepted_at ?? null,
    essential_completed_count: Number(payload.essential_completed_count ?? 0),
    essential_total_count: Number(payload.essential_total_count ?? 2),
    essential_completion_percentage: Number(
      payload.essential_completion_percentage ?? 0,
    ),
    setup_completed: payload.setup_completed === true,
    time_to_setup_seconds:
      payload.time_to_setup_seconds === null ||
      payload.time_to_setup_seconds === undefined
        ? null
        : Number(payload.time_to_setup_seconds),
    time_to_first_value_seconds:
      payload.time_to_first_value_seconds === null ||
      payload.time_to_first_value_seconds === undefined
        ? null
        : Number(payload.time_to_first_value_seconds),
    time_from_first_workspace_to_value_seconds:
      payload.time_from_first_workspace_to_value_seconds === null ||
      payload.time_from_first_workspace_to_value_seconds === undefined
        ? null
        : Number(payload.time_from_first_workspace_to_value_seconds),
  };
}
