"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCommercialNetworkContext } from "@/lib/commercial-network-context";
import { getCommercialRelationshipLedger } from "@/lib/commercial-relationship-ledger";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_EVENTS = new Set(["note","call","meeting","follow_up"]);
const path = (id: string, result: "created" | "existing" | "logged" | "invalid" | "denied" | "unavailable") =>
  "/commercial?network=" + encodeURIComponent(id) +
    "&ledger=" + result + "#commercial-relationship-ledger";

/** Explicit one-per-organization relationship creation. No CRM identity linking. */
export async function confirmCommercialRelationship(formData: FormData) {
  const companyId = String(formData.get("network_company_id") ?? "").trim();
  if (!UUID.test(companyId)) redirect("/commercial?ledger=invalid");
  if (formData.get("confirm_relationship") !== "yes") redirect(path(companyId, "invalid"));
  const context = await requireWorkspaceWriteRole();
  // Re-validate current user, organization, paid entitlement and published profile.
  const profile = await getCommercialNetworkContext(context.organizationId, companyId);
  if (!profile) redirect(path(companyId, "unavailable"));
  const state = await getCommercialRelationshipLedger(context.organizationId, companyId);
  if (state.status === "unavailable") redirect(path(companyId, "unavailable"));
  if (state.relationship) redirect(path(companyId, "existing"));

  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_network_relationships").upsert({
    organization_id: context.organizationId,
    network_company_id: companyId,
    created_by: context.userId,
  }, { onConflict: "organization_id,network_company_id", ignoreDuplicates: true })
    .select("id").maybeSingle();
  if (error) redirect(path(companyId, "unavailable"));
  revalidatePath("/commercial");
  redirect(path(companyId, data?.id ? "created" : "existing"));
}

/** Immutable human-initiated activity; no hidden auto-send, contact or supplier creation. */
export async function appendCommercialRelationshipEvent(formData: FormData) {
  const companyId = String(formData.get("network_company_id") ?? "").trim();
  const kind = String(formData.get("event_type") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!UUID.test(companyId)) redirect("/commercial?ledger=invalid");
  if (!ALLOWED_EVENTS.has(kind) || note.length < 1 || note.length > 1200 ||
      formData.get("confirm_activity") !== "yes")
    redirect(path(companyId, "invalid"));
  const context = await requireWorkspaceWriteRole();
  const profile = await getCommercialNetworkContext(context.organizationId, companyId);
  if (!profile) redirect(path(companyId, "unavailable"));
  const state = await getCommercialRelationshipLedger(context.organizationId, companyId);
  if (state.status !== "available" || !state.relationship)
    redirect(path(companyId, "unavailable"));
  // Org/identity guard on form submission; row policies and composite FK repeat it.
  if (state.relationship.organizationId !== context.organizationId ||
      state.relationship.networkCompanyId !== companyId)
    redirect(path(companyId, "denied"));

  const supabase = await createClient();
  const { error } = await supabase.from("crm_network_relationship_events").insert({
    relationship_id: state.relationship.id,
    organization_id: context.organizationId,
    actor_user_id: context.userId,
    event_type: kind,
    note,
  });
  if (error) redirect(path(companyId, "unavailable"));
  revalidatePath("/commercial");
  redirect(path(companyId, "logged"));
}
