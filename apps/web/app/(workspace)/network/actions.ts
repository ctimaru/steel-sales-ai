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


async function activeOrganizationId() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) redirect("/network?error=Nessuna%20organization%20attiva");

  return { supabase, userId, organizationId: membership.organization_id };
}

export async function saveNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network?error=Azienda%20non%20valida");

  const { supabase, userId, organizationId } = await activeOrganizationId();
  const { error } = await supabase.from("network_saved_companies").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      network_company_id: companyId,
    },
    { onConflict: "organization_id,user_id,network_company_id", ignoreDuplicates: true },
  );

  if (error) {
    redirect("/network/" + companyId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/" + companyId);
  revalidatePath("/network/saved");
  redirect("/network/" + companyId + "?message=Azienda%20salvata");
}

export async function removeSavedNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network/saved?error=Azienda%20non%20valida");

  const { supabase, userId, organizationId } = await activeOrganizationId();
  const { error } = await supabase
    .from("network_saved_companies")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("network_company_id", companyId);

  if (error) {
    redirect("/network/saved?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/" + companyId);
  revalidatePath("/network/saved");
  redirect("/network/saved?message=Azienda%20rimossa%20dai%20salvati");
}
