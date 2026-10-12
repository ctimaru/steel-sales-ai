"use server";

import { revalidatePath } from "next/cache";

import {
  buildRfqh9PoEmail,
  buildRfqh9SupplierUrl,
  createRfqh9PoSecurity,
  type Rfqh9SupplierPortal,
} from "@/lib/rfqh9-po";
import { createClient } from "@/lib/supabase/server";

function readableError(message: string) {
  if (message.includes("cannot be changed")) return "I termini del PO non sono modificabili nello stato corrente.";
  if (message.includes("cannot be issued")) return "Il PO non può essere emesso nello stato corrente.";
  if (message.includes("deadline")) return "La scadenza di conferma deve essere futura.";
  if (message.includes("not found")) return "PO non trovato o non accessibile.";
  return "Operazione Purchase Order non riuscita.";
}

async function markDelivery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  versionId: string,
  status: "sent" | "failed" | "skipped",
  providerMessageId?: string | null,
  error?: string | null,
) {
  const { error: markError } = await supabase.rpc("rfqh9_mark_issue_delivery", {
    p_po_version_id: versionId,
    p_status: status,
    p_provider: status === "skipped" ? null : "resend",
    p_provider_message_id: providerMessageId ?? null,
    p_error: error ?? null,
  });
  if (markError) console.error("RFQH9 delivery ledger update failed:", markError.message);
}

export async function updatePurchaseOrderTerms(input: {
  rfqId: string;
  poDraftId: string;
  incoterm?: string | null;
  paymentTerms?: string | null;
  deliveryDate?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per modificare il PO." };

  const { error } = await supabase.rpc("rfqh9_update_po_terms", {
    p_po_draft_id: input.poDraftId,
    p_incoterm: input.incoterm?.trim() || null,
    p_payment_terms: input.paymentTerms?.trim() || null,
    p_delivery_date: input.deliveryDate || null,
    p_lead_time_days: input.leadTimeDays ?? null,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    console.error("RFQH9 PO terms update failed:", error.message);
    return { ok: false, error: readableError(error.message) };
  }

  revalidatePath("/marketplace/rfq-hub/" + input.rfqId);
  return { ok: true };
}

export async function issuePurchaseOrder(input: {
  rfqId: string;
  poDraftId: string;
  buyerMessage?: string | null;
  confirmationDueAt?: string | null;
}): Promise<{
  ok: boolean;
  supplierUrl?: string;
  warning?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { ok: false, error: "Accedi per emettere il PO." };

  const { data: stateData, error: stateError } = await supabase.rpc("rfqh9_po_state", {
    p_rfq_id: input.rfqId,
  });

  if (stateError || !stateData || typeof stateData !== "object" || Array.isArray(stateData)) {
    return { ok: false, error: "Non è stato possibile determinare la prossima versione PO." };
  }

  const state = stateData as {
    purchase_orders?: Array<{
      id: string;
      versions?: Array<{ version_no: number }>;
    }>;
  };
  const po = (state.purchase_orders ?? []).find((item) => item.id === input.poDraftId);
  if (!po) return { ok: false, error: "PO non trovato." };

  const nextVersion =
    Math.max(0, ...(po.versions ?? []).map((version) => Number(version.version_no) || 0)) + 1;
  const security = createRfqh9PoSecurity({
    poDraftId: input.poDraftId,
    versionNo: nextVersion,
  });

  let confirmationDueAt: string | null = null;
  if (input.confirmationDueAt) {
    const date = new Date(input.confirmationDueAt);
    if (!Number.isFinite(date.getTime())) return { ok: false, error: "Scadenza conferma non valida." };
    confirmationDueAt = date.toISOString();
  }

  const { data: approvalData, error: approvalError } = await supabase.rpc(
    "rfqh13_request_approval",
    {
      p_rfq_id: input.rfqId,
      p_action_type: "po_issue",
      p_po_draft_id: input.poDraftId,
      p_reason: "Emissione Purchase Order",
      p_context: {
        buyer_message: input.buyerMessage?.trim() || null,
        confirmation_due_at: confirmationDueAt,
      },
    },
  );

  if (approvalError) {
    console.error("RFQH13 PO approval request failed:", approvalError.message);
    return { ok: false, error: readableError(approvalError.message) };
  }

  const approval =
    approvalData && typeof approvalData === "object" && !Array.isArray(approvalData)
      ? (approvalData as { required?: boolean; status?: string })
      : null;

  if (approval?.required && approval.status !== "approved") {
    return {
      ok: false,
      error:
        "Emissione PO inviata in approvazione. Dopo l'approvazione, l'owner deve ripetere l'emissione senza cambiare termini, messaggio o scadenza.",
    };
  }

  const { data, error } = await supabase.rpc("rfqh9_prepare_issue", {
    p_po_draft_id: input.poDraftId,
    p_token_hash: security.tokenHash,
    p_idempotency_key: security.idempotencyKey,
    p_buyer_message: input.buyerMessage?.trim() || null,
    p_confirmation_due_at: confirmationDueAt,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("RFQH9 PO issue failed:", error?.message);
    return { ok: false, error: readableError(error?.message ?? "PO issue failed") };
  }

  const prepared = data as {
    po_version_id?: string;
    version_no?: number;
    supplier_email?: string | null;
  };
  if (!prepared.po_version_id) return { ok: false, error: "PO emesso senza identificativo versione." };
  if (Number(prepared.version_no) !== nextVersion) {
    return { ok: false, error: "Conflitto di versione PO. Ricarica la pagina e riprova." };
  }

  const supplierUrl = buildRfqh9SupplierUrl(security.token);

  const { data: portalData } = await supabase.rpc("rfqh9_supplier_portal", {
    p_token_hash: security.tokenHash,
  });
  const portal =
    portalData && typeof portalData === "object" && !Array.isArray(portalData)
      ? (portalData as Rfqh9SupplierPortal)
      : null;

  if (!portal?.valid) {
    await markDelivery(supabase, prepared.po_version_id, "failed", null, "PO portal snapshot unavailable");
    revalidatePath("/marketplace/rfq-hub/" + input.rfqId);
    return {
      ok: true,
      supplierUrl,
      warning: "PO versionato correttamente, ma il documento supplier non è leggibile.",
    };
  }

  const recipient = prepared.supplier_email?.trim() || null;
  const apiKey = process.env.RESEND_API_KEY;

  if (!recipient) {
    await markDelivery(supabase, prepared.po_version_id, "skipped");
    revalidatePath("/marketplace/rfq-hub/" + input.rfqId);
    return {
      ok: true,
      supplierUrl,
      warning: "PO emesso. Il supplier non ha un'email: usa il link personale per condividerlo.",
    };
  }

  if (!apiKey) {
    await markDelivery(
      supabase,
      prepared.po_version_id,
      "failed",
      null,
      "RESEND_API_KEY is not configured",
    );
    revalidatePath("/marketplace/rfq-hub/" + input.rfqId);
    return {
      ok: true,
      supplierUrl,
      warning: "PO emesso, ma il canale email non è configurato. Usa il link personale.",
    };
  }

  const email = buildRfqh9PoEmail({ portal, supplierUrl });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": security.idempotencyKey,
      },
      body: JSON.stringify({
        from:
          process.env.PO_EMAIL_FROM ||
          process.env.RFQ_EMAIL_FROM ||
          "Smart Steel Sales <orders@smartsteelsales.com>",
        to: [recipient],
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: user.email ? [user.email] : undefined,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!response.ok || !payload.id) {
      throw new Error(payload.message || "Resend provider error");
    }

    await markDelivery(supabase, prepared.po_version_id, "sent", payload.id);
    revalidatePath("/marketplace/rfq-hub/" + input.rfqId);
    return { ok: true, supplierUrl };
  } catch (deliveryError) {
    const message =
      deliveryError instanceof Error ? deliveryError.message : "PO email delivery failed";
    await markDelivery(supabase, prepared.po_version_id, "failed", null, message);
    revalidatePath("/marketplace/rfq-hub/" + input.rfqId);
    return {
      ok: true,
      supplierUrl,
      warning: "PO emesso, ma l'email non è stata consegnata. Usa il link personale.",
    };
  }
}
