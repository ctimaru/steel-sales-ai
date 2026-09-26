"use server";

import { createClient } from "@/lib/supabase/server";

export type PilotEventName =
  | "search_completed"
  | "product_viewed"
  | "company_viewed"
  | "price_history_viewed"
  | "evidence_opened"
  | "review_viewed"
  | "correction_completed"
  | "upload_completed"
  | "network_directory_viewed"
  | "network_profile_viewed"
  | "network_saved_created"
  | "network_saved_removed"
  | "network_follow_created"
  | "network_follow_removed"
  | "network_activity_feed_opened"
  | "network_activity_item_opened"
  | "network_inquiry_submitted"
  | "network_inquiry_state_changed";

export type PilotEventInput = {
  eventName: PilotEventName;
  entityType?: string | null;
  entityId?: string | null;
  outcome?: "success" | "empty" | "error";
  resultCount?: number | null;
  durationMs?: number | null;
  metadata?: {
    source?: string | null;
    surface?: string | null;
    format?: string | null;
  };
};

export async function recordPilotUsageEvent(input: PilotEventInput) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false };

    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("organization_id,is_default,status")
      .eq("user_id", auth.user.id)
      .eq("status", "active");

    const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
    if (!membership?.organization_id) return { ok: false };

    const { error } = await supabase.rpc("p1_record_pilot_usage_event", {
      p_organization_id: membership.organization_id,
      p_event_name: input.eventName,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_outcome: input.outcome ?? "success",
      p_result_count: input.resultCount ?? null,
      p_duration_ms: input.durationMs ?? null,
      p_metadata: input.metadata ?? {},
    });

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
