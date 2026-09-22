"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OfferRemediationCandidate = {
  thread_id: string;
  subject: string | null;
  source_filename: string | null;
  source_conversation_id: string | null;
  conversation_id: string | null;
  category:
    | "direction_conflict"
    | "mixed_complete_unique_incomplete"
    | "product_identity_gap"
    | "source_reparse_required";
  recommended_action:
    | "manual_direction_review"
    | "manual_scope_review"
    | "product_identity_review"
    | "source_email_reparse";
  queue_id: number | null;
  queue_status: string | null;
  observation_count: number;
  complete_count: number;
  incomplete_count: number;
  direction_issue_count: number;
  low_confidence_count: number;
  product_identity_gap_count: number;
  quantity_gap_count: number;
  price_gap_count: number;
  currency_gap_count: number;
  explicit_price_currency_marker_gap_count: number;
  explicit_quantity_marker_gap_count: number;
  pending_review_count: number;
};

export type OfferRemediationReadiness = {
  summary: {
    blocked_threads: number;
    direction_conflict: number;
    mixed_complete_unique_incomplete: number;
    product_identity_gap: number;
    source_reparse_required: number;
    queued_pending: number;
    not_enqueued: number;
    price_gap_threads: number;
    currency_gap_threads: number;
    quantity_gap_threads: number;
    threads_with_explicit_missing_field_marker: number;
  };
  candidates: OfferRemediationCandidate[];
};

async function activeOrganization() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { client, organizationId: null as string | null };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  return { client, organizationId: membership?.organization_id ?? null };
}

export async function loadOfferRemediationReadiness(): Promise<{
  data: OfferRemediationReadiness | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_offer_evidence_remediation_readiness", {
    p_organization_id: organizationId,
    p_limit: 100,
  });

  if (error || !data || typeof data !== "object") {
    return { data: null, error: error?.message ?? "Offer remediation readiness non disponibile." };
  }

  return { data: data as unknown as OfferRemediationReadiness };
}

export async function enqueueOfferRemediation(
  threadId: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(threadId)) return { ok: false, error: "Thread non valido." };

  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_enqueue_offer_remediation_thread", {
    p_organization_id: organizationId,
    p_thread_id: threadId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Enqueue remediation non riuscito." };
  }

  const result = data as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status : undefined;
  const ok = status === "enqueued" || status === "already_enqueued";

  if (ok) revalidatePath("/review/offer-remediation");

  return {
    ok,
    status,
    error: ok ? undefined : typeof result.reason === "string" ? result.reason : "Thread non remediation-ready.",
  };
}
