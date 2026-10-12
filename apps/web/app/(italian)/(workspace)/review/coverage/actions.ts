"use server";

import { createClient } from "@/lib/supabase/server";

export type CoveragePayload = {
  summary: {
    observations_total: number;
    normalized_total: number;
    backlog_total: number;
    ready: number;
    needs_review: number;
    blocked: number;
    evidence_only: number;
    requested_total: number;
    requested_normalized: number;
    offered_total: number;
    offered_normalized: number;
    ordered_total: number;
    ordered_normalized: number;
    delivered_total: number;
    coverage_pct: number;
  };
  backlog: Array<{
    observation_id: number;
    item_role: string;
    backlog_status: string;
    reasons: string[];
    thread_id: string | null;
    confidence: number | null;
    grade: string | null;
    standard: string | null;
    canonical_product_key: string | null;
    source_filename: string | null;
    source_text: string | null;
  }>;
  policy: {
    requested_promotion_enabled: boolean;
    offer_promotion_enabled: boolean;
    order_promotion_enabled: boolean;
    delivered_operational_entity_enabled: boolean;
    bulk_auto_promotion: boolean;
    legacy_is_evidence: boolean;
  };
};

export type OfferReadinessPayload = {
  summary: {
    offer_threads: number;
    offered_observations: number;
    ready_threads: number;
    ready_observations: number;
    blocked_threads: number;
    partial_promoted_threads: number;
    already_promoted_threads: number;
  };
  threads: Array<{
    thread_id: string;
    readiness_status: string;
    reasons: string[];
    line_count: number;
    eligible_count: number;
    promoted_count: number;
    promoted_offer_id: string | null;
    source_filename: string | null;
    lines: Array<{
      observation_id: number;
      direction: string | null;
      confidence: number | null;
      canonical_product_key: string | null;
      quantity: number | null;
      quantity_unit: string | null;
      price_value: number | null;
      price_unit: string | null;
      currency: string | null;
      source_text: string | null;
    }>;
  }>;
  policy: {
    confidence_threshold: number;
    requires_outbound: boolean;
    requires_complete_thread: boolean;
    requires_single_currency: boolean;
    requires_canonical_identity: boolean;
    requires_quantity: boolean;
    requires_price: boolean;
    requires_no_pending_review: boolean;
    company_inference: boolean;
    rfq_inference: boolean;
    bulk_auto_promotion: boolean;
  };
};

export type OrderReadinessPayload = {
  summary: {
    order_threads: number;
    ordered_observations: number;
    ready_threads: number;
    ready_observations: number;
    blocked_threads: number;
    partial_promoted_threads: number;
    already_promoted_threads: number;
  };
  threads: Array<{
    thread_id: string;
    readiness_status: string;
    reasons: string[];
    line_count: number;
    eligible_count: number;
    promoted_count: number;
    promoted_order_id: string | null;
    source_filename: string | null;
    lines: Array<{
      observation_id: number;
      direction: string | null;
      confidence: number | null;
      canonical_product_key: string | null;
      quantity: number | null;
      quantity_unit: string | null;
      price_value: number | null;
      price_unit: string | null;
      currency: string | null;
      source_text: string | null;
    }>;
  }>;
  policy: {
    confidence_threshold: number;
    requires_inbound: boolean;
    requires_complete_thread: boolean;
    requires_canonical_identity: boolean;
    requires_quantity: boolean;
    requires_price: boolean;
    requires_no_pending_review: boolean;
    company_inference: boolean;
    rfq_inference: boolean;
    offer_inference: boolean;
    bulk_auto_promotion: boolean;
  };
};

export async function loadNormalizationCoverage(): Promise<{ data: CoveragePayload | null; error?: string }> {
  const client = await createClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return { data: null, error: "Sessione non valida." };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_normalization_coverage", {
    p_organization_id: membership.organization_id,
    p_limit: 50,
  });

  if (error || !data || typeof data !== "object") {
    return { data: null, error: "Impossibile caricare la copertura di normalizzazione." };
  }
  return { data: data as unknown as CoveragePayload };
}


export async function promoteReadyRfqObservation(
  observationId: number,
): Promise<{ ok: boolean; status?: string; rfqId?: string; error?: string }> {
  if (!Number.isSafeInteger(observationId) || observationId <= 0) {
    return { ok: false, error: "Osservazione non valida." };
  }

  const client = await createClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessione non valida." };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_promote_ready_rfq_observation", {
    p_organization_id: membership.organization_id,
    p_observation_id: observationId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Promozione RFQ non riuscita." };
  }

  const result = data as Record<string, unknown>;
  return {
    ok: result.status === "promoted" || result.status === "already_promoted",
    status: typeof result.status === "string" ? result.status : undefined,
    rfqId: typeof result.rfq_id === "string" ? result.rfq_id : undefined,
  };
}


export async function loadOfferPromotionReadiness(): Promise<{ data: OfferReadinessPayload | null; error?: string }> {
  const client = await createClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return { data: null, error: "Sessione non valida." };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_offer_promotion_readiness", {
    p_organization_id: membership.organization_id,
    p_limit: 50,
  });

  if (error || !data || typeof data !== "object") {
    return { data: null, error: "Impossibile caricare la readiness Offer." };
  }
  return { data: data as unknown as OfferReadinessPayload };
}

export async function promoteReadyOfferThread(
  threadId: string,
): Promise<{ ok: boolean; status?: string; offerId?: string; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(threadId)) {
    return { ok: false, error: "Thread non valido." };
  }

  const client = await createClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessione non valida." };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_promote_ready_offer_thread", {
    p_organization_id: membership.organization_id,
    p_thread_id: threadId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Promozione Offer non riuscita." };
  }

  const result = data as Record<string, unknown>;
  return {
    ok: result.status === "promoted" || result.status === "already_promoted",
    status: typeof result.status === "string" ? result.status : undefined,
    offerId: typeof result.offer_id === "string" ? result.offer_id : undefined,
  };
}


export async function loadOrderPromotionReadiness(): Promise<{ data: OrderReadinessPayload | null; error?: string }> {
  const client = await createClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return { data: null, error: "Sessione non valida." };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_order_promotion_readiness", {
    p_organization_id: membership.organization_id,
    p_limit: 100,
  });

  if (error || !data || typeof data !== "object") {
    return { data: null, error: "Impossibile caricare la readiness Order." };
  }
  return { data: data as unknown as OrderReadinessPayload };
}

export async function promoteReadyOrderThread(
  threadId: string,
): Promise<{ ok: boolean; status?: string; orderId?: string; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(threadId)) {
    return { ok: false, error: "Thread non valido." };
  }

  const client = await createClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessione non valida." };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_promote_ready_order_thread", {
    p_organization_id: membership.organization_id,
    p_thread_id: threadId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Promozione Order non riuscita." };
  }

  const result = data as Record<string, unknown>;
  return {
    ok: result.status === "promoted" || result.status === "already_promoted",
    status: typeof result.status === "string" ? result.status : undefined,
    orderId: typeof result.order_id === "string" ? result.order_id : undefined,
  };
}
