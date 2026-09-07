"use server";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/data/commercial";
import { createClient } from "@/lib/supabase/server";

export async function confirmReview(formData: FormData) {
  if (!isSupabaseConfigured()) return;

  const id = Number(formData.get("reviewId"));
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Review id non valido");
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    throw new Error("Sessione non autenticata");
  }

  const { error } = await supabase
    .from("commercial_review_queue")
    .update({ status: "confirmed", reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`commercial_review_queue: ${error.message}`);

  revalidatePath("/review");
  revalidatePath("/dashboard");
}
