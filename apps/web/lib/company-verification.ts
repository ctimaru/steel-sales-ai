import "server-only";

import { parseCompanyVerificationState, type CompanyVerificationState } from "@/lib/company-verification-model";
import { createClient } from "@/lib/supabase/server";

/**
 * SELFVER1: read the caller's own badge state; when every automatic signal
 * already holds, verify through the idempotent RPC once and re-read.
 * Fails soft: before the migration is applied (or on any error) it returns
 * null and the Home simply shows no verification card.
 */
export async function loadCompanyVerification(organizationId: string): Promise<CompanyVerificationState | null> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("selfver1_my_verification_state", { p_organization_id: organizationId });
    if (error) return null;
    const state = parseCompanyVerificationState(data);
    if (!state || !state.autoEligible || (state.status !== "unverified" && state.status !== "pending")) return state;
    const auto = await db.rpc("selfver1_try_auto_verify", { p_organization_id: organizationId });
    if (auto.error) return state;
    const again = await db.rpc("selfver1_my_verification_state", { p_organization_id: organizationId });
    return again.error ? state : parseCompanyVerificationState(again.data) ?? state;
  } catch {
    return null;
  }
}
