import "server-only";

import { rfqHubAttentionByRfq } from "@/lib/rfq-hub-rows";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type PurchasingAttention = {
  /** RFQ id → what the row asks you to do. */
  byRfq: Map<string, { label: string | null; urgent: boolean }>;
  /** Distinte that are «da gestire» (not archived). */
  distintaIds: string[];
};

/**
 * RFQHUB1D: one source for «Da gestire» and the menu counter. Reads the
 * procurement queue (read-only, owner/team rules applied by the database)
 * and drops RFQs whose Distinta is archived, so the counter matches the list.
 */
export async function loadPurchasingAttention(
  supabase: Client,
  organizationId: string,
): Promise<PurchasingAttention | null> {
  const queue = await supabase.rpc("rfqh10_procurement_inbox", { p_limit: 200 });
  if (queue.error) return null;
  const all = rfqHubAttentionByRfq(queue.data);
  if (!all) return null;
  const rfqIds = [...all.keys()];
  if (!rfqIds.length) return { byRfq: all, distintaIds: [] };

  const { data: campaigns, error } = await supabase.from("buyer_rfq_campaigns")
    .select("id,source_distinta_id")
    .eq("organization_id", organizationId)
    .in("id", rfqIds.slice(0, 200));
  if (error) return null;
  const distintaByRfq = new Map((campaigns ?? []).map((row) => [row.id as string, row.source_distinta_id as string]));
  const distintaIds = [...new Set(distintaByRfq.values())];

  const { data: archived, error: archivedError } = distintaIds.length
    ? await supabase.from("buyer_distintas")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", distintaIds)
      .not("archived_at", "is", null)
    : { data: [], error: null };
  if (archivedError) return null;
  const archivedIds = new Set((archived ?? []).map((row) => row.id as string));

  const byRfq = new Map<string, { label: string | null; urgent: boolean }>();
  for (const [rfqId, value] of all) {
    const distintaId = distintaByRfq.get(rfqId);
    if (!distintaId || archivedIds.has(distintaId)) continue;
    byRfq.set(rfqId, value);
  }
  return {
    byRfq,
    distintaIds: [...new Set([...byRfq.keys()].map((id) => distintaByRfq.get(id) as string))],
  };
}
