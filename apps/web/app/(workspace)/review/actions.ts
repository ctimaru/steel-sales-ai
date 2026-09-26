"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";
import { recordPilotUsageEvent } from "@/app/(workspace)/telemetry/actions";

export type ReviewActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function validId(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

function correctedValues(formData: FormData) {
  const fields = [
    ["grade", "Qualità"],
    ["standard", "Norma"],
    ["material_number", "Numero materiale"],
    ["outer_diameter_mm", "Diametro"],
    ["width_mm", "Larghezza"],
    ["height_mm", "Altezza"],
    ["thickness_mm", "Spessore"],
    ["length_mm", "Lunghezza"],
    ["quantity", "Quantità"],
    ["quantity_unit", "Unità quantità"],
    ["price_value", "Prezzo"],
    ["price_unit", "Unità prezzo"],
    ["currency", "Valuta"],
    ["discount_percentage", "Sconto"],
    ["availability_status", "Disponibilità"],
    ["note", "Nota"],
  ] as const;
  const values: Record<string, string> = {};
  for (const [key] of fields) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) values[key] = value;
  }
  return values;
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
  await requireWorkspaceWriteRole();
  await requireWorkspaceWriteRole();
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
  const values = correctedValues(formData);
  if (!Object.keys(values).length) {
    return { status: "error", message: "Inserisci almeno un valore corretto prima di salvare." };
  }

  try {
    const auth = await authenticatedClient();
    if (!auth.client) return { status: "error", message: auth.error ?? "Sessione non valida." };
    const { data, error } = await auth.client.rpc(
      "p1_apply_commercial_review_correction",
      {
        p_review_id: Number(rawId),
        p_corrected_values: values,
      },
    );

    if (error) return { status: "error", message: "Correzione non salvata. Riprova tra poco." };
    if (
      !data ||
      typeof data !== "object" ||
      Number((data as { review_id?: unknown }).review_id) !== Number(rawId) ||
      (data as { status?: unknown }).status !== "corrected"
    ) {
      return { status: "error", message: "Nessuna correzione promossa: il record non è disponibile o è già stato revisionato." };
    }
    await recordPilotUsageEvent({
      eventName: "correction_completed",
      entityType: "review",
      entityId: String(rawId),
      outcome: "success",
      metadata: { surface: "review" },
    });
    try {
      revalidatePath("/review");
      revalidatePath("/dashboard");
      revalidatePath("/search");
      revalidatePath("/products");
    } catch {
      return { status: "success", message: "Correzione applicata ai dati commerciali. Aggiorna la pagina per vedere i dati aggiornati." };
    }
    return { status: "success", message: "Correzione applicata: Search e Product History useranno subito il dato aggiornato." };
  } catch {
    return { status: "error", message: "Non è stato possibile verificare il salvataggio. Aggiorna la pagina prima di riprovare." };
  }
}
