"use server";

import { rfqHubAttentionCount } from "@/lib/rfq-hub-rows";
import { createClient } from "@/lib/supabase/server";

/**
 * RFQHUB1: how many requests need an action (offers arrived, deadlines,
 * orders to confirm). Shown next to «Centro RFQ» in the menu. Read-only;
 * the procurement queue applies its own owner and team visibility rules.
 */
export async function getPurchasingAttentionCount(): Promise<number> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return 0;
  const { data, error } = await supabase.rpc("rfqh10_procurement_inbox", { p_limit: 200 });
  if (error) return 0;
  return rfqHubAttentionCount(data);
}
