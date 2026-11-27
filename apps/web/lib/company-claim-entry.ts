import "server-only";

import { redirect } from "next/navigation";
import { normalizeCompanyClaimRef } from "@/lib/company-claim-intent";
import { createClient } from "@/lib/supabase/server";

export type CompanyClaimEntryFailure = "target_unavailable" | "not_admin" | "unavailable";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** organizationId comes only from the signed-in user's active, default membership. */
export async function continueCompanyClaimForMember(
  reference: string,
  organizationId: string,
): Promise<CompanyClaimEntryFailure> {
  const claimRef = normalizeCompanyClaimRef(reference);
  if (!claimRef) return "target_unavailable";
  if (!UUID.test(organizationId)) return "unavailable";
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return "unavailable";
  }

  let resolution;
  try {
    resolution = await supabase.rpc("company_claim1a_resolve_target", {
      p_claim_ref: claimRef,
      p_organization_id: organizationId,
    });
  } catch {
    return "unavailable";
  }
  if (resolution.error) return resolution.error.code === "42501" ? "not_admin" : "unavailable";
  const result = resolution.data as {
    contract?: unknown; ok?: unknown; code?: unknown; network_company_id?: unknown;
  } | null;
  if (!result || result.contract !== "company-claim1a-target-v1") return "unavailable";
  if (result.ok === false && result.code === "target_unavailable" && result.network_company_id === null) {
    return "target_unavailable";
  }
  if (result.ok !== true || result.code !== "resolved" ||
      typeof result.network_company_id !== "string" || !UUID.test(result.network_company_id)) {
    return "unavailable";
  }

  // Keep the exact company through the existing legal-acceptance step too.
  // HP5 and its writer will recheck membership, eligibility and ownership.
  const destination = `/network/${result.network_company_id.toLowerCase()}/claim`;
  let legalResult;
  try {
    legalResult = await supabase.rpc("lr5_current_legal_acceptance_state");
  } catch {
    return "unavailable";
  }
  if (legalResult.error) return "unavailable";
  if ((legalResult.data as { accepted?: boolean } | null)?.accepted !== true) {
    redirect("/legal/accept?next=" + encodeURIComponent(destination));
  }
  redirect(destination);
}
