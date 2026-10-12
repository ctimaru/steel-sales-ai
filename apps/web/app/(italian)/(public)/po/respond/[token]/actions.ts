"use server";

import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function submitPurchaseOrderDecision(input: {
  token: string;
  decision: "confirmed" | "rejected" | "change_requested";
  message?: string | null;
  confirmedDeliveryDate?: string | null;
  supplierReference?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const cleanToken = input.token.trim();
  if (!cleanToken) return { ok: false, error: "Link PO non valido." };

  const message = input.message?.trim() || null;
  if (
    (input.decision === "rejected" || input.decision === "change_requested") &&
    !message
  ) {
    return { ok: false, error: "Inserisci una motivazione per questa risposta." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("rfqh9_supplier_decide", {
    p_token_hash: tokenHash(cleanToken),
    p_decision: input.decision,
    p_message: message,
    p_confirmed_delivery_date: input.confirmedDeliveryDate || null,
    p_supplier_reference: input.supplierReference?.trim() || null,
  });

  if (error) {
    console.error("RFQH9 supplier decision failed:", error.message);
    return {
      ok: false,
      error: error.message.includes("deadline")
        ? "La scadenza di conferma è trascorsa."
        : error.message.includes("not open")
          ? "Questa versione del PO non è più aperta alla risposta."
          : "Non è stato possibile registrare la risposta al PO.",
    };
  }

  return { ok: true };
}
