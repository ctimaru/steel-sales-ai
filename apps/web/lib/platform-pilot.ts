import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type PilotReadiness = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  onboarding_status: string;
  participant_role: "buyer" | "supplier" | "both";
  ready: boolean;
  blockers: string[];
  active_members: number;
  network_company_id: string | null;
  network_company_name: string | null;
  publication_status: string | null;
  claimed_status: string | null;
  verification_status: string | null;
  supplier_product_relationships: number;
  technical_scope_products: number;
};

export type PilotParticipant = {
  participant_id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  participant_role: "buyer" | "supplier" | "both";
  status: "candidate" | "active" | "paused" | "completed" | "removed";
  activation_cycle: number;
  added_at: string;
  activated_at: string | null;
  paused_at: string | null;
  readiness: PilotReadiness;
};

export type PilotCandidateOrganization = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  onboarding_status: string;
  buyer_readiness: PilotReadiness;
  supplier_readiness: PilotReadiness;
  participant: {
    participant_id: string;
    participant_role: "buyer" | "supplier" | "both";
    status: PilotParticipant["status"];
  } | null;
};

export type PilotControl = {
  contract: "P5.6A-v1";
  generated_at: string;
  run: {
    id: string;
    status: "active";
    label: string;
    protocol_version: "P5.6-v1";
    started_at: string;
    planned_ends_at: string;
  } | null;
  counts: {
    total: number;
    candidates: number;
    active: number;
    paused: number;
    buyers: number;
    suppliers: number;
  };
  participants: PilotParticipant[];
  candidate_organizations: PilotCandidateOrganization[];
};

export async function getMarketplacePilotControl() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_6a_pilot_control");

  if (error) {
    if (error.code === "42501") redirect("/platform");
    throw new Error(error.message);
  }

  return data as PilotControl;
}
