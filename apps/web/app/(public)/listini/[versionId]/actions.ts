"use server";

import { revalidatePath } from "next/cache";

import type {
  DiscountScopeType,
  DiscountVisibility,
} from "@/lib/private-pricing";
import { createClient } from "@/lib/supabase/server";

type SaveDiscountProfileInput = {
  versionId: string;
  scopeType: DiscountScopeType;
  discountPct: number;
  visibility: DiscountVisibility;
  gradeCode?: string | null;
  finishCode?: string | null;
  sectionId?: string | null;
  itemId?: string | null;
  label?: string | null;
};

export async function saveDiscountProfile(
  input: SaveDiscountProfileInput,
): Promise<{ ok: boolean; profileId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per salvare un profilo sconto." };
  }

  if (!Number.isFinite(input.discountPct) || input.discountPct < 0 || input.discountPct > 100) {
    return { ok: false, error: "Lo sconto deve essere compreso tra 0 e 100%." };
  }

  const { data, error } = await supabase.rpc("pl1_save_discount_profile", {
    p_version_id: input.versionId,
    p_scope_type: input.scopeType,
    p_discount_pct: input.discountPct,
    p_visibility: input.visibility,
    p_section_id: input.sectionId ?? null,
    p_grade_code: input.gradeCode?.trim() || null,
    p_finish_code: input.finishCode?.trim() || null,
    p_price_list_item_id: input.itemId ?? null,
    p_label: input.label?.trim() || null,
  });

  if (error) {
    console.error("PL1.7 save profile failed:", error.message);
    return {
      ok: false,
      error:
        error.message.includes("organization discount profiles require admin role")
          ? "Solo un amministratore aziendale può modificare i profili condivisi."
          : "Non è stato possibile salvare il profilo sconto.",
    };
  }

  revalidatePath("/listini/" + input.versionId);
  revalidatePath("/listini");

  return { ok: true, profileId: typeof data === "string" ? data : undefined };
}

export async function deactivateDiscountProfile(
  versionId: string,
  profileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per modificare i profili sconto." };
  }

  const { data, error } = await supabase.rpc("pl1_deactivate_discount_profile", {
    p_profile_id: profileId,
  });

  if (error || data !== true) {
    if (error) console.error("PL1.7 deactivate profile failed:", error.message);
    return {
      ok: false,
      error: "Non è stato possibile disattivare il profilo sconto.",
    };
  }

  revalidatePath("/listini/" + versionId);
  revalidatePath("/listini");

  return { ok: true };
}
