"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function requestNetworkClaim(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  const organizationId = textValue(formData, "organization_id");

  if (!companyId || !organizationId) redirect("/network?error=Claim%20non%20valido");

  const supabase = await createClient();
  const { error } = await supabase.rpc("m4_request_company_claim", {
    p_network_company_id: companyId,
    p_organization_id: organizationId,
    p_note: "Requested from M8 Network profile",
  });

  if (error) {
    redirect("/network/" + companyId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/" + companyId);
  revalidatePath("/network/manage");
  redirect("/network/" + companyId + "?message=" + encodeURIComponent("Claim inviato al Platform Superadmin."));
}

export async function updateManagedNetworkProfile(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network/manage?error=Profilo%20non%20valido");

  const supabase = await createClient();
  const { error } = await supabase.rpc("m8_update_managed_network_company", {
    p_network_company_id: companyId,
    p_trading_name: textValue(formData, "trading_name") || null,
    p_website_url: textValue(formData, "website_url") || null,
    p_description: textValue(formData, "description") || null,
  });

  if (error) {
    redirect("/network/manage?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/manage");
  revalidatePath("/network/" + companyId);
  redirect("/network/manage?message=Profilo%20Network%20aggiornato");
}
