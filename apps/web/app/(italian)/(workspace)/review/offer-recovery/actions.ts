"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OfferRecoveryCandidate = {
  thread_id: string;
  subject: string | null;
  conversation_id: string | null;
  source_conversation_id: string;
  recovery_status: "ready" | "blocked" | "already_recovered";
  reasons: string[];
  observation_count: number;
  complete_count: number;
  incomplete_count: number;
  unique_incomplete_count: number;
  complete_lines: Array<{
    observation_id: number;
    canonical_product_key: string;
    quantity: number;
    quantity_unit: string;
    price_value: number;
    price_unit: string;
    currency: string;
    source_text: string;
  }>;
  retained_evidence_lines: Array<{
    observation_id: number;
    canonical_product_key: string | null;
    quantity: number | null;
    quantity_unit: string | null;
    source_text: string;
  }>;
};

export type RelationshipGapOfferRecoveryAudit = {
  relationship_gap: {
    rfq_total: number;
    order_total: number;
    shared_conversation_pairs: number;
    shared_conversation_exact_product_pairs: number;
    normalized_offer_total: number;
  };
  offer_gap: {
    offered_observations: number;
    offer_threads: number;
    complete_observations: number;
    threads_with_any_complete_line: number;
    safe_subset_recovery_ready: number;
    already_recovered: number;
    blocked_recovery_threads: number;
  };
  candidates: OfferRecoveryCandidate[];
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

export async function loadRelationshipGapOfferRecoveryAudit(): Promise<{
  data: RelationshipGapOfferRecoveryAudit | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_relationship_gap_offer_recovery_audit", {
    p_organization_id: organizationId,
    p_limit: 100,
  });

  if (error || !data || typeof data !== "object") {
    return { data: null, error: error?.message ?? "Audit Offer recovery non disponibile." };
  }

  return { data: data as unknown as RelationshipGapOfferRecoveryAudit };
}

export async function recoverShadowDuplicateOffer(
  threadId: string,
): Promise<{ ok: boolean; status?: string; offerId?: string; error?: string }> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(threadId)) return { ok: false, error: "Thread non valido." };

  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_recover_shadow_duplicate_offer", {
    p_organization_id: organizationId,
    p_thread_id: threadId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Offer recovery non riuscito." };
  }

  const result = data as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status : undefined;
  const ok = status === "recovered" || status === "already_recovered";

  if (ok) {
    revalidatePath("/review/offer-recovery");
    revalidatePath("/review/coverage");
    revalidatePath("/review/relationships");
    revalidatePath("/explorer");
  }

  return {
    ok,
    status,
    offerId: typeof result.offer_id === "string" ? result.offer_id : undefined,
    error: ok ? undefined : "Recovery bloccato dal contratto PA2.25.",
  };
}
