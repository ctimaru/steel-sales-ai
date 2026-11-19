"use server";

import { canWriteWorkspace } from "@/lib/access-policy";
import { parseDealIndex } from "@/lib/commercial-deal-model";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

/**
 * COMM-CLIENTS1: «Richieste d'offerta · 3» in the menu. Same source and rules
 * as the «Da fare» filter of the list (public.comm_deals2_index, sales only),
 * so the number always matches what the page shows. Read-only, RLS-scoped.
 */
export async function getSalesAttentionCount(): Promise<number> {
  try {
    const context = await getWorkspaceContext();
    if (!canWriteWorkspace(context.role)) return 0;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("comm_deals2_index", {
      p_organization_id: context.organizationId, p_segment: "sales", p_filter: "todo",
      p_query: "", p_limit: 1, p_offset: 0,
    });
    if (error) return 0;
    return parseDealIndex(data)?.counts.filters.todo ?? 0;
  } catch {
    return 0;
  }
}
