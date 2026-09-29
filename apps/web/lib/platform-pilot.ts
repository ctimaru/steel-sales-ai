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

export type PilotLatencyStats = {
  samples: number;
  avg_seconds: number | null;
  p50_seconds: number | null;
  min_seconds: number | null;
  max_seconds: number | null;
};

export type PilotTelemetryParticipant = {
  participant_id: string;
  organization_id: string;
  organization_name: string;
  participant_role: "buyer" | "supplier" | "both";
  status: PilotParticipant["status"];
  published_listings: number;
  notifications_received: number;
  notifications_read: number;
  opportunities_opened: number;
  unlocks: number;
  response_drafts: number;
  responses_submitted: number;
  buyer_engagement_actions: number;
};

export type PilotTelemetryListing = {
  request_id: string;
  buyer_organization_id: string;
  buyer_organization_name: string;
  visibility_mode: "named" | "anonymous";
  published_at: string;
  matches: number;
  pilot_contactable_matches: number;
  notifications_created: number;
  notifications_read: number;
  opportunities_opened: number;
  unlocks: number;
  response_drafts: number;
  responses_submitted: number;
  buyer_engaged_responses: number;
  first_match_at: string | null;
};

export type PilotTelemetry = {
  contract: "P5.6B-v1";
  generated_at: string;
  run: PilotControl["run"];
  funnel: {
    listings_published: number;
    listings_with_match: number;
    listing_match_rate: number | null;
    matches: number;
    matches_per_listing: number | null;
    pilot_contactable_matches: number;
    notifications_created: number;
    notifications_read: number;
    notifications_dismissed: number;
    notification_read_rate: number | null;
    opportunities_opened: number;
    notification_to_open_rate: number | null;
    unlocks: number;
    open_to_unlock_rate: number | null;
    response_drafts: number;
    unlock_to_draft_rate: number | null;
    responses_submitted: number;
    unlock_to_submit_rate: number | null;
    buyer_engaged_responses: number;
    submitted_to_buyer_engagement_rate: number | null;
    distinct_buyer_organizations: number;
    distinct_supplier_organizations: number;
    distinct_organizations: number;
  };
  latencies: {
    listing_to_first_match: PilotLatencyStats;
    match_to_notification_read: PilotLatencyStats;
    notification_to_opportunity_open: PilotLatencyStats;
    opportunity_open_to_unlock: PilotLatencyStats;
    unlock_to_draft_response: PilotLatencyStats;
    unlock_to_submitted_response: PilotLatencyStats;
    submitted_response_to_buyer_engagement: PilotLatencyStats;
  };
  participants: PilotTelemetryParticipant[];
  listings: PilotTelemetryListing[];
  measurement?: {
    hard_event_source: string;
    soft_event: string;
    soft_event_source: string;
    content_payload_copied: boolean;
  };
};

export async function getMarketplacePilotTelemetry() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_6b_pilot_telemetry");

  if (error) {
    if (error.code === "42501") redirect("/platform");
    throw new Error(error.message);
  }

  return data as PilotTelemetry;
}
