import "server-only";

import { createClient } from "@/lib/supabase/server";

/** NET-DISTINTA-REUSE1: private, organization-scoped saved bills offered on a
 * Network company's RDO entry. Never surface archived, empty, or already-sent
 * requests. All data is revalidated on click by the server action. */
export type NetworkRdoSavedDistinta = {
  id: string;
  title: string;
  lineCount: number;
  totalTonnes: number | null;
  createdAt: string;
  existingRfq: boolean;
};

export type NetworkRdoSavedDistintaResult = {
  items: NetworkRdoSavedDistinta[];
  error: boolean;
};

const PREPARATION = new Set(["draft", "ready"]);

export async function listNetworkRdoSavedDistintas(
  organizationId: string,
  userId: string,
): Promise<NetworkRdoSavedDistintaResult> {
  const db = await createClient();
  const { data: snapshots, error } = await db.from("buyer_distintas")
    .select("id,title,line_count,total_tonnes,created_at")
    .eq("organization_id", organizationId)
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .gt("line_count", 0)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return { items: [], error: true };
  if (!snapshots?.length) return { items: [], error: false };

  const ids = snapshots.map((row) => row.id);
  const { data: campaigns, error: campaignError } = await db.from("buyer_rfq_campaigns")
    .select("id,source_distinta_id,status")
    .eq("organization_id", organizationId)
    .eq("owner_user_id", userId)
    .in("source_distinta_id", ids);
  // On an RFQ lookup failure, do not accidentally offer already-sent requests.
  if (campaignError) return { items: [], error: true };

  const byDistinta = new Map<string, string[]>();
  for (const campaign of campaigns ?? []) {
    if (!campaign.source_distinta_id) continue;
    const statuses = byDistinta.get(campaign.source_distinta_id) ?? [];
    statuses.push(campaign.status);
    byDistinta.set(campaign.source_distinta_id, statuses);
  }

  return {
    error: false,
    items: snapshots.filter((row) => {
      const statuses = byDistinta.get(row.id) ?? [];
      return statuses.every((status) => PREPARATION.has(status));
    }).map((row) => ({
      id: row.id,
      title: row.title?.trim() || "Distinta senza titolo",
      lineCount: row.line_count,
      totalTonnes: row.total_tonnes === null ? null : Number(row.total_tonnes),
      createdAt: row.created_at,
      existingRfq: (byDistinta.get(row.id)?.length ?? 0) > 0,
    })),
  };
}
