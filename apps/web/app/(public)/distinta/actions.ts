"use server";

import { revalidatePath } from "next/cache";

import {
  buildBuyerDistintaHtml,
  buildBuyerDistintaPlainText,
  calculateBuyerDistintaLine,
  calculateBuyerDistintaTotals,
  type BuyerDistintaDraftLine,
} from "@/lib/buyer-distinta";
import { trackServerProductEvent } from "@/lib/product-analytics-events.server";
import { createClient } from "@/lib/supabase/server";

type SaveBuyerDistintaInput = {
  title: string;
  lines: BuyerDistintaDraftLine[];
};

type SendBuyerDistintaInput = {
  distintaId: string;
  recipients: string[];
  subject: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;


export async function createBuyerRfqCampaign(
  distintaId: string,
): Promise<{ ok: boolean; rfqId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per creare un RFQ multi-fornitore." };
  }

  const { data, error } = await supabase.rpc("rfqh1_create_campaign_from_distinta", {
    p_distinta_id: distintaId,
    p_due_at: null,
    p_buyer_message: null,
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

  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 500) {
    return { ok: false, error: "La distinta deve contenere da 1 a 500 righe." };
  }

  const calculated = input.lines.map(calculateBuyerDistintaLine);
  if (calculated.some((line) => !line.complete)) {
    return {
      ok: false,
      error:
        "Completa articolo, quantità, peso kg/m e Target €/t di tutte le righe prima di salvare.",
    };
  }

  const totals = calculateBuyerDistintaTotals(calculated);
  const payload = {
    title: input.title.trim() || "Richiesta di offerta",
    total_meters: totals.totalMeters,
    total_tonnes: totals.totalTonnes,
    target_total_eur: totals.targetTotalEur,
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

export async function sendBuyerDistinta(
  input: SendBuyerDistintaInput,
): Promise<{ ok: boolean; sentCount?: number; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    return { ok: false, error: "Accedi per inviare la distinta ai fornitori." };
  }

  const recipients = Array.from(
    new Set(
      (input.recipients ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (recipients.length < 1 || recipients.length > 25 || recipients.some((email) => !EMAIL_RE.test(email))) {
    return {
      ok: false,
      error: "Inserisci da 1 a 25 indirizzi email fornitori validi.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.BUYER_DISTINTA_FROM_EMAIL ||
    "Smart Steel Sales <noreply@smartsteelsales.com>";

  if (!apiKey) {
    return {
      ok: false,
      error:
        "Il canale di invio diretto non è ancora configurato sul server. La distinta resta copiabile e salvabile.",
    };
  }

  const { data: distinta, error: distintaError } = await supabase
    .from("buyer_distintas")
    .select("id,title,owner_user_id")
    .eq("id", input.distintaId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (distintaError || !distinta) {
    return { ok: false, error: "Salva la distinta prima di inviarla." };
  }

  const { data: rows, error: linesError } = await supabase
    .from("buyer_distinta_lines")
    .select(
      "line_position,description,standard_code,grade_code,finish_code,quantity_mode,quantity,bar_length_m,weight_kg_m,line_meters,line_tonnes,target_eur_t,target_eur_m,target_total_eur,note",
    )
    .eq("distinta_id", distinta.id)
    .order("line_position", { ascending: true });

  if (linesError || !rows?.length) {
    return { ok: false, error: "Non è stato possibile rileggere le righe salvate." };
  }

  const exportLines = rows.map((row) => ({
    id: String(row.line_position),
    description: row.description,
    standard: row.standard_code ?? "",
    grade: row.grade_code ?? "",
    finish: row.finish_code ?? "",
    quantityMode: row.quantity_mode as "meters" | "bars" | "tonnes",
    quantity: Number(row.quantity),
    barLengthM: row.bar_length_m === null ? null : Number(row.bar_length_m),
    weightKgM: Number(row.weight_kg_m),
    targetEurT: Number(row.target_eur_t),
    targetEurM: Number(row.target_eur_m),
    meters: Number(row.line_meters),
    tonnes: Number(row.line_tonnes),
    targetTotalEur: Number(row.target_total_eur),
    note: row.note ?? "",
    complete: true,
  }));

  const title = distinta.title || "Richiesta di offerta";
  const extraMessage = input.message?.trim() || "";
  const plain =
    (extraMessage ? extraMessage + "\n\n" : "") +
    buildBuyerDistintaPlainText(title, exportLines);
  const html =
    (extraMessage
      ? '<p style="font-family:Arial,sans-serif;color:#1f2937;">' +
        extraMessage
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll("\n", "<br/>") +
        "</p>"
      : "") + buildBuyerDistintaHtml(title, exportLines);

  const subject = input.subject.trim() || title;
  const providerIds: string[] = [];
  let sendError: string | null = null;

  for (const recipient of recipients) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html,
        text: plain,
        reply_to: user.email ? [user.email] : undefined,
      }),
      cache: "no-store",
    });

    const responseBody = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!response.ok) {
      sendError = responseBody.message || "Provider email error";
      break;
    }
    if (responseBody.id) providerIds.push(responseBody.id);
  }

  await supabase.from("buyer_distinta_deliveries").insert({
    distinta_id: distinta.id,
    owner_user_id: user.id,
    recipients,
    subject,
    provider: "resend",
    provider_message_id: providerIds.join(",") || null,
    status: sendError ? "failed" : "sent",
    error_message: sendError,
  });

  if (sendError) {
    console.error("BD1 supplier delivery failed:", sendError);
    return {
      ok: false,
      error: "Invio non completato. Controlla la configurazione email o riprova.",
    };
  }

  return { ok: true, sentCount: recipients.length };
}
