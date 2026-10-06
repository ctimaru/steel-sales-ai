"use server";

import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

type QuoteHeaderInput = {
  incoterm?: string | null;
  paymentTerms?: string | null;
  validityUntil?: string | null;
  leadTimeDays?: string | number | null;
  deliveryDate?: string | null;
  moqTonnes?: string | number | null;
  notes?: string | null;
};

export type QuoteLineInput = {
  lineId: string;
  responseStatus: "quoted" | "not_available";
  priceBasis?: "eur_t" | "eur_m" | null;
  unitPrice?: string | number | null;
  offeredQuantity?: string | number | null;
  offeredQuantityMode?: "meters" | "tonnes" | "bars" | null;
  moqTonnes?: string | number | null;
  leadTimeDays?: string | number | null;
  deliveryDate?: string | null;
  notes?: string | null;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function quoteError(message: string) {
  if (message.includes("deadline")) return "La scadenza della RFQ è già trascorsa.";
  if (message.includes("Every RFQ line")) return "Completa una risposta per ogni riga della distinta.";
  if (message.includes("valid price")) return "Ogni riga quotata deve avere prezzo e unità validi.";
  if (message.includes("Start a revision")) return "L'offerta è già inviata: avvia una nuova revisione per modificarla.";
  if (message.includes("Declined RFQ")) return "Questa RFQ è stata rifiutata e non è più modificabile.";
  if (message.includes("Quote at least one")) return "Quota almeno una riga oppure rifiuta la RFQ.";
  if (message.includes("not available") || message.includes("not open")) return "Questa RFQ non è più disponibile per la risposta.";
  return "Non è stato possibile salvare la risposta. Controlla i dati e riprova.";
}

export async function saveSupplierQuote(input: {
  token: string;
  header: QuoteHeaderInput;
  lines: QuoteLineInput[];
}): Promise<{ ok: boolean; error?: string }> {
  const token = input.token.trim();
  if (!token) return { ok: false, error: "Link RFQ non valido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("rfqh4_save_quote", {
    p_token_hash: tokenHash(token),
    p_header: {
      incoterm: input.header.incoterm ?? "",
      payment_terms: input.header.paymentTerms ?? "",
      validity_until: input.header.validityUntil ?? "",
      lead_time_days:
        input.header.leadTimeDays === null || input.header.leadTimeDays === undefined
          ? ""
          : String(input.header.leadTimeDays),
      delivery_date: input.header.deliveryDate ?? "",
      moq_tonnes:
        input.header.moqTonnes === null || input.header.moqTonnes === undefined
          ? ""
          : String(input.header.moqTonnes),
      notes: input.header.notes ?? "",
    },
    p_lines: input.lines.map((line) => ({
      line_id: line.lineId,
      response_status: line.responseStatus,
      price_basis: line.responseStatus === "quoted" ? line.priceBasis ?? "" : "",
      unit_price:
        line.responseStatus === "quoted" &&
        line.unitPrice !== null &&
        line.unitPrice !== undefined
          ? String(line.unitPrice)
          : "",
      offered_quantity:
        line.offeredQuantity === null || line.offeredQuantity === undefined
          ? ""
          : String(line.offeredQuantity),
      offered_quantity_mode: line.offeredQuantityMode ?? "",
      moq_tonnes:
        line.moqTonnes === null || line.moqTonnes === undefined
          ? ""
          : String(line.moqTonnes),
      lead_time_days:
        line.leadTimeDays === null || line.leadTimeDays === undefined
          ? ""
          : String(line.leadTimeDays),
      delivery_date: line.deliveryDate ?? "",
      notes: line.notes ?? "",
    })),
  });

  if (error) {
    console.error("RFQH4 draft save failed:", error.message);
    return { ok: false, error: quoteError(error.message) };
  }

  return { ok: true };
}

export async function submitSupplierQuote(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rfqh4_submit_quote", {
    p_token_hash: tokenHash(token.trim()),
  });

  if (error) {
    console.error("RFQH4 quote submit failed:", error.message);
    return { ok: false, error: quoteError(error.message) };
  }

  return { ok: true };
}

export async function declineSupplierQuote(
  token: string,
  reason?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rfqh4_decline", {
    p_token_hash: tokenHash(token.trim()),
    p_reason: reason?.trim() || null,
  });

  if (error) {
    console.error("RFQH4 quote decline failed:", error.message);
    return { ok: false, error: quoteError(error.message) };
  }

  return { ok: true };
}

export async function startSupplierQuoteRevision(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rfqh4_start_revision", {
    p_token_hash: tokenHash(token.trim()),
  });

  if (error) {
    console.error("RFQH4 revision start failed:", error.message);
    return { ok: false, error: quoteError(error.message) };
  }

  return { ok: true };
}


export async function sendSupplierNegotiationMessage(
  token: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const cleanToken = token.trim();
  const cleanBody = body.trim();

  if (!cleanToken) return { ok: false, error: "Link RFQ non valido." };
  if (!cleanBody) return { ok: false, error: "Scrivi un messaggio prima di inviare." };
  if (cleanBody.length > 4000) {
    return { ok: false, error: "Il messaggio supera il limite di 4000 caratteri." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("rfqh6_supplier_post", {
    p_token_hash: tokenHash(cleanToken),
    p_body: cleanBody,
  });

  if (error) {
    console.error("RFQH6 supplier negotiation post failed:", error.message);
    return {
      ok: false,
      error: error.message.includes("hourly limit")
        ? "Hai raggiunto il limite temporaneo di messaggi. Riprova più tardi."
        : error.message.includes("closed")
          ? "La trattativa è stata chiusa dal buyer."
          : error.message.includes("not open")
            ? "La RFQ non è più aperta alla negoziazione."
            : "Non è stato possibile inviare il messaggio.",
    };
  }

  return { ok: true };
}
