"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReviewActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function validId(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

function correctedValues(formData: FormData) {
  const textFields = [
    "item_role",
    "product_type",
    "grade",
    "standard",
    "material_number",
    "quantity_unit",
    "price_unit",
    "currency",
    "availability_status",
  ] as const;
  const numericFields = [
    "outer_diameter_mm",
    "width_mm",
    "height_mm",
    "thickness_mm",
    "length_mm",
    "quantity",
    "price_value",
    "discount_percentage",
  ] as const;

  const values: Record<string, string | number> = {};
  for (const key of textFields) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) values[key] = value;
  }
  for (const key of numericFields) {
    const raw = String(formData.get(key) ?? "").trim().replace(",", ".");
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return { values: null, note: "", error: `Valore numerico non valido: ${key}.` };
    }
    values[key] = value;
  }

  return {
    values,
    note: String(formData.get("note") ?? "").trim(),
    error: null,
  };
}

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

async function authenticatedClient() {
  if (!configured()) return { client: null, user: null, error: "Salvataggio non disponibile: connessione ai dati non configurata." };
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client: null, user: null, error: "Sessione scaduta o non valida. Accedi di nuovo." };
  return { client, user, error: null };
}

export async function confirmReviewItem(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const rawId = formData.get("id");
  if (!validId(rawId)) return { status: "error", message: "Record non valido. Aggiorna la pagina e riprova." };

  try {
    const auth = await authenticatedClient();
    if (!auth.client) return { status: "error", message: auth.error ?? "Sessione non valida." };
    const { data, error } = await auth.client
      .from("commercial_review_queue")
      .update({ status: "confirmed", reviewed_at: new Date().toISOString() })
      .eq("id", Number(rawId))
      .eq("owner_id", auth.user?.id)
      .eq("status", "pending")
      .select("id,status")
      .maybeSingle();

    if (error) return { status: "error", message: "Conferma non salvata. Riprova tra poco." };
    if (!data || data.id !== Number(rawId) || data.status !== "confirmed") {
      return { status: "error", message: "Nessuna conferma salvata: il record non è disponibile o è già stato revisionato." };
    }
    try {
      revalidatePath("/review");
      revalidatePath("/dashboard");
    } catch {
      return { status: "success", message: "Conferma salvata. Aggiorna la pagina per aggiornare i conteggi." };
    }
    return { status: "success", message: "Conferma salvata." };
  } catch {
    return { status: "error", message: "Non è stato possibile verificare il salvataggio. Aggiorna la pagina prima di riprovare." };
  }
}

export async function correctReviewItem(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const rawId = formData.get("id");
  if (!validId(rawId)) return { status: "error", message: "Record non valido. Aggiorna la pagina e riprova." };

  const correction = correctedValues(formData);
  if (correction.error || !correction.values) {
    return { status: "error", message: correction.error ?? "Correzione non valida." };
  }
  if (!Object.keys(correction.values).length) {
    return { status: "error", message: "Inserisci almeno un valore corretto prima di salvare." };
  }

  try {
    const auth = await authenticatedClient();
    if (!auth.client) return { status: "error", message: auth.error ?? "Sessione non valida." };

    const { data, error } = await auth.client.rpc("p1_apply_commercial_review_correction", {
      p_review_id: Number(rawId),
      p_corrected_values: correction.values,
      p_note: correction.note || null,
    });

    if (error) return { status: "error", message: "Correzione non applicata. Controlla i valori e riprova." };

    const payload = data as Record<string, unknown> | null;
    if (!payload || !["corrected", "already_corrected"].includes(String(payload.status ?? ""))) {
      return { status: "error", message: "La correzione non è stata confermata dal database." };
    }

    try {
      revalidatePath("/review");
      revalidatePath("/dashboard");
      revalidatePath("/explorer");
      revalidatePath("/search");
      revalidatePath("/products");
    } catch {
      return { status: "success", message: "Correzione applicata. Aggiorna la pagina per vedere tutti i dati aggiornati." };
    }

    return {
      status: "success",
      message: payload.status === "already_corrected"
        ? "Correzione già applicata."
        : "Correzione applicata a Search e Product History.",
    };
  } catch {
    return { status: "error", message: "Non è stato possibile verificare la correzione. Aggiorna la pagina prima di riprovare." };
  }
}
