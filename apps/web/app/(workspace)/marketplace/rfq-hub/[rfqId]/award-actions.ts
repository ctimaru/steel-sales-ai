"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type Rfqh7AwardAllocationInput = {
  lineId: string;
  supplierId: string;
  awardedTonnes: string | number;
};

function awardError(message: string) {
  if (message.includes("already confirmed")) return "L'award di questa RFQ è già stato confermato.";
  if (message.includes("not eligible for award")) return "La RFQ non è più eleggibile per l'award.";
  if (message.includes("latest quote must be submitted")) return "Uno dei fornitori selezionati ha una revisione non ancora inviata.";
  if (message.includes("100% of every RFQ line")) return "L'award deve coprire il 100% di ogni riga RFQ.";
  if (message.includes("exceeds supplier offered quantity")) return "Una quantità assegnata supera la quantità offerta dal fornitore.";
  if (message.includes("exceeds requested quantity")) return "Una quantità assegnata supera la quantità richiesta.";
  if (message.includes("reason")) return "Inserisci una motivazione dell'award.";
  return "Non è stato possibile confermare l'award. Verifica quantità e fornitori selezionati.";
}

export async function confirmRfqAward(input: {
  rfqId: string;
  reason: string;
  allocations: Rfqh7AwardAllocationInput[];
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per confermare l'award." };

  const allocations = input.allocations
    .map((item) => ({
      line_id: item.lineId.trim(),
      supplier_id: item.supplierId.trim(),
      awarded_tonnes: String(item.awardedTonnes).trim().replace(",", "."),
    }))
    .filter((item) => item.line_id && item.supplier_id && item.awarded_tonnes);

  const { error } = await supabase.rpc("rfqh7_confirm_award", {
    p_rfq_id: input.rfqId.trim(),
    p_reason: input.reason.trim(),
    p_allocations: allocations,
  });

  if (error) {
    console.error("RFQH7 award confirmation failed:", error.message);
    return { ok: false, error: awardError(error.message) };
  }

  revalidatePath("/marketplace/rfq-hub/" + input.rfqId.trim());
  return { ok: true };
}
