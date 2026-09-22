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
