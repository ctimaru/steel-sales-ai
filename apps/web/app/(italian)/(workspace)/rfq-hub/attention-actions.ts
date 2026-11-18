"use server";

import { canWriteWorkspace } from "@/lib/access-policy";
import { loadPurchasingAttention } from "@/lib/rfq-hub-attention";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

/**
 * RFQHUB1D: how many Distinte wait for you (offers arrived, deadlines,
 * failed sends, orders). Same source and rules as «Da gestire» in Centro RFQ,
 * so the number in the menu always matches the list. Read-only.
 */
export async function getPurchasingAttentionCount(): Promise<number> {
  try {
    const context = await getWorkspaceContext();
    if (!canWriteWorkspace(context.role)) return 0;
    const supabase = await createClient();
    const attention = await loadPurchasingAttention(supabase, context.organizationId);
    return attention?.distintaIds.length ?? 0;
  } catch {
    return 0;
  }
}
