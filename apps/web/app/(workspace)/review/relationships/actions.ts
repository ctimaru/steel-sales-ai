"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type RelationshipCandidate = {
  relationship_type: "offer_rfq" | "order_offer" | "order_rfq";
  source_entity_id: string;
  target_entity_id: string;
  conversation_id: string;
  evidence_type: string;
};

export type RelationshipReadiness = {
  summary: {
    ready_total: number;
    offer_rfq_ready: number;
    order_offer_ready: number;
    order_rfq_ready: number;
  };
  candidates: RelationshipCandidate[];
  policy: {
    requires_shared_normalized_conversation: boolean;
    requires_exact_product_multiset: boolean;
    requires_unique_candidate: boolean;
    company_inference: boolean;
    email_domain_inference: boolean;
    legacy_thread_similarity: boolean;
    bulk_auto_activation: boolean;
  };
};

async function activeOrganizationId() {
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

export async function loadRelationshipReadiness(): Promise<{
  data: RelationshipReadiness | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganizationId();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_operational_relationship_readiness", {
    p_organization_id: organizationId,
    p_limit: 100,
  });

  if (error || !data || typeof data !== "object") {
    return { data: null, error: error?.message ?? "Readiness relazioni non disponibile." };
  }

  return { data: data as unknown as RelationshipReadiness };
}

export async function activateRelationship(
  relationshipType: RelationshipCandidate["relationship_type"],
  sourceEntityId: string,
  targetEntityId: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(sourceEntityId) || !uuid.test(targetEntityId)) {
    return { ok: false, error: "Identificativo relazione non valido." };
  }

  const { client, organizationId } = await activeOrganizationId();
  if (!organizationId) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_activate_operational_relationship", {
    p_organization_id: organizationId,
    p_relationship_type: relationshipType,
    p_source_entity_id: sourceEntityId,
    p_target_entity_id: targetEntityId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Attivazione relazione non riuscita." };
  }

  const result = data as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status : undefined;
  const ok = status === "applied" || status === "already_applied";

  if (ok) {
    revalidatePath("/review/relationships");
    revalidatePath("/explorer");
  }

  return {
    ok,
    status,
    error: ok ? undefined : typeof result.reason === "string" ? result.reason : "Relazione bloccata.",
  };
}
