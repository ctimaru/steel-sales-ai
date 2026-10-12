"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ConversationCoverageCandidate = {
  commercial_thread_id: string;
  source_conversation_id: string;
  subject: string | null;
  started_at: string | null;
  last_activity_at: string | null;
  email_count: number;
  readiness_status: string;
  reasons: string[];
};

export type ConversationCoverageReadiness = {
  summary: {
    commercial_threads: number;
    conversation_ready: number;
    conversation_already_normalized: number;
    conversation_blocked: number;
    message_ready: number;
    message_identity_unavailable: number;
    source_email_count: number;
  };
  candidates: ConversationCoverageCandidate[];
  policy: {
    conversation_identity: string;
    conversation_subject_copy: boolean;
    conversation_timestamps_copy: boolean;
    company_inference: boolean;
    message_synthesis: boolean;
    message_reason: string;
    bulk_auto_expansion: boolean;
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

export async function loadStructuredConversationCoverage(): Promise<{
  data: ConversationCoverageReadiness | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_structured_conversation_coverage_readiness", {
    p_organization_id: organizationId,
    p_limit: 100,
  });

  if (error || !data || typeof data !== "object") {
    return { data: null, error: error?.message ?? "Coverage Conversation non disponibile." };
  }

  return { data: data as unknown as ConversationCoverageReadiness };
}

export async function expandStructuredConversation(
  commercialThreadId: string,
): Promise<{ ok: boolean; status?: string; conversationId?: string; error?: string }> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(commercialThreadId)) return { ok: false, error: "Thread non valido." };

  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_expand_structured_conversation", {
    p_organization_id: organizationId,
    p_commercial_thread_id: commercialThreadId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Espansione Conversation non riuscita." };
  }

  const result = data as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status : undefined;
  const ok = status === "expanded" || status === "already_normalized";

  if (ok) {
    revalidatePath("/review/conversation-coverage");
    revalidatePath("/review/conversations");
    revalidatePath("/review/relationships");
    revalidatePath("/explorer");
  }

  return {
    ok,
    status,
    conversationId: typeof result.conversation_id === "string" ? result.conversation_id : undefined,
    error: ok ? undefined : typeof result.reason === "string" ? result.reason : "Espansione bloccata.",
  };
}
