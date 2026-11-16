"use server";

import { revalidatePath } from "next/cache";

import { recordPilotUsageEvent } from "@/app/(workspace)/telemetry/actions";
import { canWriteWorkspace } from "@/lib/access-policy";
import { getNetworkAccessState } from "@/lib/network-access";
import type { NetworkSaveResult, NetworkSaveSurface } from "@/lib/network-save-events";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SURFACES = new Set<NetworkSaveSurface>([
  "network_directory",
  "network_company_profile",
  "network_saved_companies",
  "home_feed",
]);

/**
 * NET-SAVE-INLINE1 (founder request, 16 Nov 2026): the one writer for the private
 * saved list. Never redirects: the button updates in place and shows a toast.
 *
 * Same rules as before: workspace write role, live Network access, the session
 * organization and the signed-in user. RLS stays authoritative
 * (network_saved_companies_* + PA1.3 restrictive entitlement policy; only
 * published companies can be saved). Idempotent: saving twice or removing a
 * missing row is a success, so double clicks and retries are harmless.
 */
export async function toggleNetworkSavedCompany(
  companyId: string,
  save: boolean,
  surface: NetworkSaveSurface,
): Promise<NetworkSaveResult> {
  if (typeof companyId !== "string" || !UUID.test(companyId) || typeof save !== "boolean") {
    return { ok: false, saved: !save, reason: "invalid" };
  }
  const safeSurface: NetworkSaveSurface = SURFACES.has(surface) ? surface : "network_directory";
  try {
    const context = await getWorkspaceContext();
    if (!canWriteWorkspace(context.role)) return { ok: false, saved: !save, reason: "forbidden" };
    const access = await getNetworkAccessState(context.organizationId).catch(() => null);
    if (!access?.can_access_network) return { ok: false, saved: !save, reason: "locked" };

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { ok: false, saved: !save, reason: "unavailable" };

    const { error } = save
      ? await supabase.from("network_saved_companies").upsert(
          { organization_id: context.organizationId, user_id: userId, network_company_id: companyId },
          { onConflict: "organization_id,user_id,network_company_id", ignoreDuplicates: true },
        )
      : await supabase
          .from("network_saved_companies")
          .delete()
          .eq("organization_id", context.organizationId)
          .eq("user_id", userId)
          .eq("network_company_id", companyId);
    if (error) return { ok: false, saved: !save, reason: "unavailable" };

    await recordPilotUsageEvent({
      eventName: save ? "network_saved_created" : "network_saved_removed",
      entityType: "network_company",
      entityId: companyId,
      metadata: { surface: safeSurface },
    });

    const { count, error: countError } = await supabase
      .from("network_saved_companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .eq("user_id", userId);

    // The directory keeps its client state; only the pages that list saved state re-render.
    revalidatePath("/network/saved");
    revalidatePath("/network/" + companyId);
    return { ok: true, saved: save, count: countError || typeof count !== "number" ? null : count };
  } catch {
    return { ok: false, saved: !save, reason: "unavailable" };
  }
}
