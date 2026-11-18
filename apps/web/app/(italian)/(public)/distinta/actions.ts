"use server";

import { revalidatePath } from "next/cache";

import {
  calculateBuyerDistintaLine,
  calculateBuyerDistintaTotals,
  type BuyerDistintaDraftLine,
} from "@/lib/buyer-distinta";
import {
  formatBuyerDocumentRequirements, normalizeBuyerDocumentRequirements,
  type BuyerDistintaDocumentRequirements,
} from "@/lib/buyer-distinta-documents";
import { trackServerProductEvent } from "@/lib/product-analytics-events.server";
import { distintaAutoTitle } from "@/lib/rfq-hub-rows";
import { createClient } from "@/lib/supabase/server";

type SaveBuyerDistintaInput = {
  title: string;
  lines: BuyerDistintaDraftLine[];
  documents: BuyerDistintaDocumentRequirements;
};

type SendBuyerDistintaInput = {
  distintaId: string;
  recipients: string[];
  subject: string;
  message?: string;
};



export async function createBuyerRfqCampaign(
  distintaId: string,
): Promise<{ ok: boolean; rfqId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per creare un RFQ multi-fornitore." };
  }

  const { data: distinta } = await supabase
    .from("buyer_distintas")
    .select("document_requirements")
    .eq("id", distintaId)
    .eq("owner_user_id", authData.user.id)
    .maybeSingle();
  if (!distinta) return { ok: false, error: "Distinta non trovata o non autorizzata." };
  // A successful RPC may have committed even if the browser lost its response.
  // Reusing the existing owner-scoped campaign makes retries safe without
  // needing a second snapshot or a schema change.
  const { data: previous, error: lookupError } = await supabase
    .from("buyer_rfq_campaigns")
    .select("id")
    .eq("source_distinta_id", distintaId)
    .eq("owner_user_id", authData.user.id)
    .limit(1)
    .maybeSingle();
  if (lookupError) return { ok: false, error: "Impossibile verificare se esiste già una RFQ. Riprova." };
  if (previous?.id) return { ok: true, rfqId: previous.id };
  const documents = normalizeBuyerDocumentRequirements(distinta.document_requirements);
  const { data, error } = await supabase.rpc("rfqh1_create_campaign_from_distinta", {
    p_distinta_id: distintaId,
    p_due_at: null,
    p_buyer_message: formatBuyerDocumentRequirements(documents) || null,
  });

  if (error) {
    console.error("RFQH1 create campaign failed:", error.message);
    return {
      ok: false,
      error: error.message.includes("Active organization required")
        ? "Completa e attiva la tua azienda prima di creare un RFQ."
        : "Non è stato possibile creare il RFQ Hub da questa distinta.",
    };
  }

  const rfqId = typeof data === "string" ? data : null;
  if (!rfqId) {
    return { ok: false, error: "RFQ creato senza identificativo." };
  }

  revalidatePath("/marketplace/rfq-hub");
  await trackServerProductEvent("rfq_start", { source: "distinta" });
  return { ok: true, rfqId };
}

export async function saveBuyerDistinta(
  input: SaveBuyerDistintaInput,
): Promise<{ ok: boolean; distintaId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per salvare la distinta." };
  }

  // CALC-DIST3: named private snapshots must have bounded, human-readable titles.
  if (typeof input.title !== "string" || !input.title.trim()
      || input.title.trim().length > 120 || /[\x00-\x1f\x7f]/.test(input.title)) {
    return { ok: false, error: "Inserisci un nome distinta valido (massimo 120 caratteri)." };
  }

  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 500) {
    return { ok: false, error: "La distinta deve contenere da 1 a 500 righe." };
  }

  const calculated = input.lines.map(calculateBuyerDistintaLine);
  if (calculated.some((line) => !line.complete)) {
    return {
      ok: false,
      error:
        "Completa articolo, quantità e peso kg/m di tutte le righe; se inserisci un Target €/t deve essere positivo.",
    };
  }

  const totals = calculateBuyerDistintaTotals(calculated);
  const payload = {
    // RFQHUB1D: the default name becomes the first article, so the Distinte
    // in Centro RFQ can be told apart.
    title: distintaAutoTitle(input.title, calculated.map((line) => line.description)),
    total_meters: totals.totalMeters,
    total_tonnes: totals.totalTonnes,
    target_total_eur: totals.targetTotalEur,
    document_requirements: normalizeBuyerDocumentRequirements(input.documents),
  };

  const lines = calculated.map((line) => ({
    description: line.description,
    standard: line.standard,
    grade: line.grade,
    finish: line.finish,
    quantity_mode: line.quantityMode,
    quantity: line.quantity,
    bar_length_m: line.quantityMode === "bars" ? line.barLengthM : "",
    weight_kg_m: line.weightKgM,
    line_meters: line.meters,
    line_tonnes: line.tonnes,
    target_eur_t: line.targetEurT,
    target_eur_m: line.targetEurM,
    target_total_eur: line.targetTotalEur,
    note: line.note,
  }));

  const { data, error } = await supabase.rpc("buyer_create_distinta_snapshot", {
    p_distinta: payload,
    p_lines: lines,
  });

  if (error) {
    console.error("BD1 save Buyer Distinta failed:", error.message);
    return { ok: false, error: "Non è stato possibile salvare la distinta." };
  }

  const distintaId = typeof data === "string" ? data : null;
  if (!distintaId) {
    return { ok: false, error: "Salvataggio completato senza identificativo." };
  }

  revalidatePath("/distinta");
  await trackServerProductEvent("distinta_save", { line_count: lines.length });
  return { ok: true, distintaId };
}

// DISTINTA-ONE1 (founder decision, 17 Nov 2026): the direct email send of a
// bill of material is retired. Every supplier request goes through the RFQ,
// with its recipients review and explicit confirmation. The action stays as a
// closed endpoint so older open tabs get a clear answer instead of an error.
export async function sendBuyerDistinta(
  _input: SendBuyerDistintaInput,
): Promise<{ ok: boolean; sentCount?: number; error?: string }> {
  return { ok: false, error: "L'invio diretto della distinta non è più disponibile: crea la richiesta e scegli i fornitori." };
}
