"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordPilotUsageEvent } from "@/app/(workspace)/telemetry/actions";
import { getCommercialNetworkContext } from "@/lib/commercial-network-context";
import { getCommercialNetworkProspect } from "@/lib/commercial-network-prospect";
import { canWriteWorkspace } from "@/lib/access-policy";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const feedbackPath = (id: string, state: "saved" | "existing" | "invalid" | "unavailable" | "denied") =>
  "/commercial?network=" + encodeURIComponent(id) + "&prospect=" + state + "#network-commercial-context";

/** Explicit user-confirmed private bookmark. Never writes Company 360 or RFQ. */
export async function confirmCommercialNetworkProspect(formData: FormData) {
  const companyId = String(formData.get("network_company_id") ?? "").trim();
  const confirmed = formData.get("confirm_prospect") === "yes";
  // Never reflect an arbitrary malformed query value into a redirect.
  if (!UUID.test(companyId)) redirect("/commercial?prospect=invalid");
  if (!confirmed) redirect(feedbackPath(companyId, "invalid"));

  const context = await getWorkspaceContext();
  if (!canWriteWorkspace(context.role)) redirect(feedbackPath(companyId, "denied"));

  // Re-evaluate feature+entitlement and the published company on POST.
  // A GET page displaying it before revocation is not authorization.
  const publicProfile = await getCommercialNetworkContext(context.organizationId, companyId);
  if (!publicProfile) redirect(feedbackPath(companyId, "unavailable"));

  const existing = await getCommercialNetworkProspect(context.organizationId, context.userId, companyId);
  if (existing.status === "saved") redirect(feedbackPath(companyId, "existing"));
  if (existing.status === "unavailable") redirect(feedbackPath(companyId, "unavailable"));

  const supabase = await createClient();
  const { data, error } = await supabase.from("network_saved_companies").upsert({
    organization_id: context.organizationId,
    user_id: context.userId,
    network_company_id: companyId,
  }, {
    onConflict: "organization_id,user_id,network_company_id",
    ignoreDuplicates: true,
  }).select("id").maybeSingle();

  if (error) redirect(feedbackPath(companyId, "unavailable"));

  // Log only a genuinely created bookmark, not duplicate confirmation.
  if (data?.id) {
    await recordPilotUsageEvent({
      eventName: "network_saved_created",
      entityType: "network_company",
      entityId: companyId,
      metadata: { surface: "commercial_network_prospect", intent: "manual_shortlist" },
    }).catch(() => undefined);
  }
  revalidatePath("/commercial");
  revalidatePath("/network/saved");
  redirect(feedbackPath(companyId, data?.id ? "saved" : "existing"));
}
