import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseDashFeed7Snapshot, type DashFeed7Snapshot } from "@/lib/dashboard-feed7-model";

export async function getDashFeed7Insights(days: 7 | 30): Promise<DashFeed7Snapshot | null> {
  try {
    const supabase = await createClient();
    const { data,error } = await supabase.rpc("dash_feed7_platform_insights",{ p_days:days });
    if (error) return null;
    return parseDashFeed7Snapshot(data,days);
  } catch {
    return null;
  }
}
