"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ConversationBackfillCandidate = {
  entity_type: "rfq" | "offer" | "order";
  entity_id: string;
  candidate_conversation_id: string;
  evidence_type: "source_message" | "source_conversation_id";
  line_count: number;
  reasons: string[];
};

export type ConversationBackfillReadiness = {
  summary: {
    entities_total: number;
    ready: number;
    already_linked: number;
    blocked: number;
    unresolved: number;
    rfq_ready: number;
    offer_ready: number;
    order_ready: number;
  };
  candidates: ConversationBackfillCandidate[];
  policy: {
    source_message_exact: boolean;
    source_conversation_id_exact: boolean;
    subject_inference: boolean;
    email_domain_inference: boolean;
    free_text_inference: boolean;
    legacy_thread_similarity: boolean;
    bulk_auto_backfill: boolean;
  };
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

export async function loadConversationBackfillReadiness(): Promise<{
  data: ConversationBackfillReadiness | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_conversation_backfill_readiness", {
    p_organization_id: organizationId,
    p_limit: 100,
  });

  if (error || !data || typeof data !== "object") {
    return { data: null, error: error?.message ?? "Readiness Conversation non disponibile." };
  }

  return { data: data as unknown as ConversationBackfillReadiness };
}

export async function applyConversationBackfill(
  entityType: ConversationBackfillCandidate["entity_type"],
  entityId: string,
  conversationId: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(entityId) || !uuid.test(conversationId)) {
    return { ok: false, error: "Identificativo non valido." };
  }

  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_apply_conversation_backfill", {
    p_organization_id: organizationId,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_conversation_id: conversationId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Backfill Conversation non riuscito." };
  }

  const result = data as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status : undefined;
  const ok = status === "applied" || status === "already_applied" || status === "already_linked";

  if (ok) {
    revalidatePath("/review/conversations");
    revalidatePath("/review/relationships");
    revalidatePath("/explorer");
  }

  return {
    ok,
    status,
    error: ok ? undefined : typeof result.reason === "string" ? result.reason : "Backfill bloccato.",
  };
}
