"use server";

import { revalidatePath } from "next/cache";

import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { supplierContactError } from "@/lib/rfqhub-suppliers";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export async function updateSupplierProfile(input: {
  profileId: string;
  preferred: boolean;
  tags: string[];
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per modificare la rubrica supplier." };
  }

  const profileId = input.profileId.trim();
  if (!profileId) {
    return { ok: false, error: "Profilo supplier non valido." };
  }

  const tags = Array.from(
    new Set(
      input.tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 32)),
    ),
  ).slice(0, 10);

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 4000) {
    return { ok: false, error: "Le note possono contenere al massimo 4000 caratteri." };
  }

  const { error } = await supabase.rpc("rfqh11_update_supplier_profile", {
    p_profile_id: profileId,
    p_preferred: input.preferred,
    p_tags: tags,
    p_notes: notes,
  });

  if (error) {
    console.error("RFQH11 supplier profile update failed:", error.message);
    return {
      ok: false,
      error: error.message.includes("not accessible")
        ? "Profilo supplier non trovato o non accessibile."
        : "Non è stato possibile aggiornare il supplier.",
    };
  }

  revalidatePath(appRoutes.rfqHub.suppliers);
  revalidatePath(appRoutes.marketplace.suppliers);
  revalidatePath(appRoutes.rfqHub.supplier(profileId));
  revalidatePath(appRoutes.marketplace.supplier(profileId));
  revalidatePath(appRoutes.rfqHub.home);

  return { ok: true };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RFQHUB1B: save a commercial contact for a supplier in the organization's
 * Commerciale (companies/contacts). Write members only; the database checks
 * membership again and never moves a contact between suppliers.
 */
export async function saveSupplierContact(input: {
  networkCompanyId?: string | null;
  companyId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  role?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const context = await getWorkspaceContext();
  if (!canWriteWorkspace(context.role)) {
    return { ok: false, error: "Il tuo ruolo può consultare la rubrica, non modificarla." };
  }
  const networkCompanyId = input.networkCompanyId && UUID.test(input.networkCompanyId) ? input.networkCompanyId : null;
  const companyId = !networkCompanyId && input.companyId && UUID.test(input.companyId) ? input.companyId : null;
  if (!networkCompanyId && !companyId) return { ok: false, error: supplierContactError("target") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rfqhub1b_save_supplier_contact", {
    p_organization_id: context.organizationId,
    p_network_company_id: networkCompanyId,
    p_company_id: companyId,
    p_full_name: String(input.fullName ?? "").slice(0, 200),
    p_email: String(input.email ?? "").slice(0, 300),
    p_phone: input.phone ? String(input.phone).slice(0, 60) : null,
    p_role: input.role ? String(input.role).slice(0, 100) : null,
  });
  if (error) {
    console.error("RFQHUB1B supplier contact save failed:", error.message);
    return { ok: false, error: supplierContactError(null) };
  }
  const result = data && typeof data === "object" && !Array.isArray(data) ? (data as { ok?: boolean; error?: string }) : null;
  if (!result?.ok) return { ok: false, error: supplierContactError(result?.error) };

  revalidatePath(appRoutes.rfqHub.suppliers);
  return { ok: true };
}
