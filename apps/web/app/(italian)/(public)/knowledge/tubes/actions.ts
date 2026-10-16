"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Read-only, click-time eligibility check. Keep the public calculator's
 * indexable page free of auth cookies and user-specific server rendering.
 * Snapshot save and RFQ create separately reauthenticate and enforce RLS/RPC.
 */
export async function inlinePrivateRfqAccess():
  Promise<{state:"guest"|"ready"|"needs-company"|"unavailable"}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return {state:"unavailable"};
  }
  try {
    const supabase=await createClient();
    const {data:{user},error}=await supabase.auth.getUser();
    if(error || !user) return {state:"guest"};
    const {data:membership,error:membershipError}=await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("status","active").limit(1);
    if(membershipError) return {state:"unavailable"};
    if(!membership?.length) return {state:"needs-company"};
    return {state:"ready"};
  } catch {
    return {state:"unavailable"};
  }
}
