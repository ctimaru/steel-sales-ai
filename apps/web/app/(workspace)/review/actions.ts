"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReviewActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function confirmReviewItem(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const rawId = formData.get("id");
  if (typeof rawId !== "string" || !/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) {
    return { status: "error", message: "Record non valido. Aggiorna la pagina e riprova." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { status: "error", message: "Salvataggio non disponibile: connessione ai dati non configurata." };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { status: "error", message: "Sessione scaduta o non valida. Accedi di nuovo per confermare." };
    }

    // The owner filter complements RLS; pending prevents overwriting another review.
    const { data, error } = await supabase
      .from("commercial_review_queue")
      .update({ status: "confirmed", reviewed_at: new Date().toISOString() })
      .eq("id", Number(rawId))
      .eq("owner_id", user.id)
      .eq("status", "pending")
      .select("id,status")
      .maybeSingle();

    if (error) {
      return { status: "error", message: "Conferma non salvata. Riprova tra poco." };
    }
    if (!data || data.id !== Number(rawId) || data.status !== "confirmed") {
      return {
        status: "error",
        message: "Nessuna conferma salvata: il record non è disponibile o è già stato revisionato. Aggiorna la pagina.",
      };
    }
  } catch {
    // A network failure may occur after a write: do not claim it was not saved.
    return {
      status: "error",
      message: "Non è stato possibile verificare il salvataggio. Aggiorna la pagina prima di riprovare.",
    };
  }

  try {
    revalidatePath("/review");
    revalidatePath("/dashboard");
  } catch {
    return { status: "success", message: "Conferma salvata. Aggiorna la pagina per aggiornare i conteggi." };
  }
  return { status: "success", message: "Conferma salvata." };
}
