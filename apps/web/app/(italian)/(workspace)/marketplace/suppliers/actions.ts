"use server";

import { revalidatePath } from "next/cache";

import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

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
