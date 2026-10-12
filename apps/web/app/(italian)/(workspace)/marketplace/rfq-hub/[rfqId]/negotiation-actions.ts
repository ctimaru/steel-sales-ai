"use server";

import { revalidatePath } from "next/cache";

import {
  createRfqh3DispatchSecurity,
} from "@/lib/rfqh3-dispatch";
import {
  buildRfqh6NegotiationEmail,
  type Rfqh6NegotiationKind,
  type Rfqh6SharedTarget,
} from "@/lib/rfqh6-negotiation";
import { createClient } from "@/lib/supabase/server";

export type BuyerNegotiationMessageType =
  | "message"
  | "clarification"
  | "revision_request"
  | "counter_target"
  | "bafo_request";

export type BuyerNegotiationTargetInput = {
  lineId: string;
  basis: "eur_t" | "eur_m";
  value: string | number;
};

type BuyerNegotiationInput = {
  rfqId: string;
  supplierId: string;
  messageType: BuyerNegotiationMessageType;
  body: string;
  dueAt?: string | null;
  counterTargets?: BuyerNegotiationTargetInput[];
};

function readableError(message: string) {
  if (message.includes("daily limit")) return "Limite giornaliero messaggi raggiunto per questa trattativa.";
  if (message.includes("deadline")) return "La deadline di negoziazione deve essere futura.";
  if (message.includes("BAFO deadline")) return "Imposta una deadline per la Best & Final Offer.";
  if (message.includes("at least one line")) return "Inserisci almeno un counter target per una riga.";
  if (message.includes("not open")) return "La RFQ non è aperta alla negoziazione.";
  if (message.includes("not available")) return "Questo fornitore non è disponibile per la negoziazione.";
  if (message.includes("closed")) return "La trattativa con questo fornitore è chiusa.";
  if (message.includes("cooldown")) return "Il prossimo promemoria sarà disponibile dopo 24 ore.";
  if (message.includes("reminder limit")) return "Hai già inviato i 2 promemoria consentiti per questa richiesta.";
  if (message.includes("No supplier action")) return "Non c'è una richiesta al fornitore in attesa di risposta.";
  return "Non è stato possibile aggiornare la trattativa.";
}

async function sendEmail(input: {
  apiKey: string;
  from: string;
  replyTo: string | null;
  recipient: string;
  idempotencyKey: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + input.apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.recipient],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo ? [input.replyTo] : undefined,
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

  return payload.id;
}

async function loadNotificationContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rfqId: string,
  supplierId: string,
) {
  const [{ data: campaign }, { data: supplier }, { data: dispatch }] =
    await Promise.all([
      supabase
        .from("buyer_rfq_campaigns")
        .select("id,title,organization_id")
        .eq("id", rfqId)
        .maybeSingle(),
      supabase
        .from("buyer_rfq_suppliers")
        .select("id,supplier_name,supplier_email_normalized")
        .eq("id", supplierId)
        .eq("rfq_id", rfqId)
        .maybeSingle(),
      supabase
        .from("buyer_rfq_dispatches")
        .select("id,attempt_count,status")
        .eq("rfq_id", rfqId)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!campaign || !supplier || !dispatch) return null;

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", campaign.organization_id)
    .maybeSingle();

  return {
    campaign,
    supplier,
    dispatch,
    organizationName: organization?.name || "Buyer Smart Steel Sales",
  };
}

async function markNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageId: string,
  status: "sent" | "failed" | "skipped",
  providerMessageId?: string | null,
  error?: string | null,
) {
  const { error: markError } = await supabase.rpc("rfqh6_mark_notification", {
    p_message_id: messageId,
    p_status: status,
    p_provider_message_id: providerMessageId ?? null,
    p_error: error ?? null,
  });

  if (markError) {
    console.error("RFQH6 notification ledger update failed:", markError.message);
  }
}

async function deliverNegotiationNotification(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userEmail: string | null;
  rfqId: string;
  supplierId: string;
  messageId: string;
  kind: Rfqh6NegotiationKind;
  body: string;
  dueAt: string | null;
}) {
  const context = await loadNotificationContext(
    input.supabase,
    input.rfqId,
    input.supplierId,
  );

  if (!context?.supplier.supplier_email_normalized) {
    await markNotification(input.supabase, input.messageId, "skipped");
    return { sent: false, warning: "Messaggio salvato; il fornitore non ha un'email notificabile." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !process.env.RFQ_INVITE_SECRET) {
    await markNotification(
      input.supabase,
      input.messageId,
      "failed",
      null,
      "RFQ email channel is not configured",
    );
    return { sent: false, warning: "Messaggio salvato, ma la notifica email non è configurata." };
  }

  const attemptVersion = Number(context.dispatch.attempt_count);
  if (!Number.isFinite(attemptVersion) || attemptVersion < 1) {
    await markNotification(
      input.supabase,
      input.messageId,
      "failed",
      null,
      "Invalid dispatch attempt version",
    );
    return { sent: false, warning: "Messaggio salvato, ma non è stato possibile ricostruire il link RFQ." };
  }

  const security = createRfqh3DispatchSecurity({
    dispatchId: context.dispatch.id,
    rfqId: context.campaign.id,
    supplierId: context.supplier.id,
    attemptVersion,
  });

  const { data: targetRows } = await input.supabase
    .from("buyer_rfq_negotiation_targets")
    .select("rfq_line_id,normalized_eur_t,normalized_eur_m")
    .eq("message_id", input.messageId);

  const lineIds = (targetRows ?? []).map((row) => row.rfq_line_id);
  const lineById = new Map<string, { line_position: number; description: string }>();

  if (lineIds.length > 0) {
    const { data: lines } = await input.supabase
      .from("buyer_distinta_lines")
      .select("id,line_position,description")
      .in("id", lineIds);

    for (const line of lines ?? []) {
      lineById.set(line.id, {
        line_position: Number(line.line_position),
        description: line.description,
      });
    }
  }

  const targets: Rfqh6SharedTarget[] = (targetRows ?? [])
    .map((target) => {
      const line = lineById.get(target.rfq_line_id);
      if (!line) return null;
      return {
        position: line.line_position,
        description: line.description,
        eurT: Number(target.normalized_eur_t),
        eurM: Number(target.normalized_eur_m),
      };
    })
    .filter((target): target is Rfqh6SharedTarget => Boolean(target));

  const email = buildRfqh6NegotiationEmail({
    buyerOrganizationName: context.organizationName,
    supplierName: context.supplier.supplier_name,
    rfqTitle: context.campaign.title,
    kind: input.kind,
    body: input.body,
    dueAt: input.dueAt,
    inviteToken: security.token,
    targets,
  });

  try {
    const providerMessageId = await sendEmail({
      apiKey,
      from:
        process.env.RFQ_EMAIL_FROM ||
        "Smart Steel Sales <rfq@smartsteelsales.com>",
      replyTo: input.userEmail,
      recipient: context.supplier.supplier_email_normalized,
      idempotencyKey: "rfqh6-" + input.messageId,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    await markNotification(
      input.supabase,
      input.messageId,
      "sent",
      providerMessageId,
    );
    return { sent: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Negotiation email provider error";
    await markNotification(
      input.supabase,
      input.messageId,
      "failed",
      null,
      message,
    );
    return {
      sent: false,
      warning: "Messaggio salvato, ma la notifica email non è stata consegnata.",
    };
  }
}

export async function postBuyerRfqNegotiation(
  input: BuyerNegotiationInput,
): Promise<{ ok: boolean; warning?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) return { ok: false, error: "Accedi per negoziare la RFQ." };

  const rfqId = input.rfqId.trim();
  const supplierId = input.supplierId.trim();
  if (!rfqId || !supplierId) return { ok: false, error: "RFQ o fornitore non validi." };

  let dueAt: string | null = null;
  if (input.dueAt) {
    const date = new Date(input.dueAt);
    if (!Number.isFinite(date.getTime())) {
      return { ok: false, error: "Deadline non valida." };
    }
    dueAt = date.toISOString();
  }

  const { data, error } = await supabase.rpc("rfqh6_buyer_post", {
    p_rfq_id: rfqId,
    p_supplier_id: supplierId,
    p_message_type: input.messageType,
    p_body: input.body.trim(),
    p_due_at: dueAt,
    p_counter_targets: (input.counterTargets ?? [])
      .filter((target) => String(target.value).trim() !== "")
      .map((target) => ({
        line_id: target.lineId,
        basis: target.basis,
        value: String(target.value).trim().replace(",", "."),
      })),
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("RFQH6 buyer negotiation post failed:", error?.message);
    return {
      ok: false,
      error: readableError(error?.message ?? "Negotiation post failed"),
    };
  }

  const payload = data as {
    message_id?: string;
  };
  if (!payload.message_id) {
    return { ok: false, error: "Messaggio salvato senza identificativo." };
  }

  const delivered = await deliverNegotiationNotification({
    supabase,
    userEmail: user.email ?? null,
    rfqId,
    supplierId,
    messageId: payload.message_id,
    kind: input.messageType,
    body: input.body.trim() || "Aggiornamento trattativa RFQ.",
    dueAt,
  });

  revalidatePath("/marketplace/rfq-hub/" + rfqId);
  return { ok: true, warning: delivered.warning };
}

export async function sendBuyerNegotiationReminder(
  input: { rfqId: string; threadId: string },
): Promise<{ ok: boolean; warning?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) return { ok: false, error: "Accedi per inviare il promemoria." };

  const { data, error } = await supabase.rpc("rfqh6_prepare_reminder", {
    p_thread_id: input.threadId.trim(),
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("RFQH6 reminder prepare failed:", error?.message);
    return {
      ok: false,
      error: readableError(error?.message ?? "Negotiation reminder failed"),
    };
  }

  const payload = data as {
    message_id?: string;
    rfq_id?: string;
    supplier_id?: string;
  };

  if (!payload.message_id || !payload.rfq_id || !payload.supplier_id) {
    return { ok: false, error: "Promemoria preparato senza riferimenti completi." };
  }

  const { data: message } = await supabase
    .from("buyer_rfq_negotiation_messages")
    .select("body,request_due_at")
    .eq("id", payload.message_id)
    .maybeSingle();

  const delivered = await deliverNegotiationNotification({
    supabase,
    userEmail: user.email ?? null,
    rfqId: payload.rfq_id,
    supplierId: payload.supplier_id,
    messageId: payload.message_id,
    kind: "reminder",
    body: message?.body || "Promemoria negoziazione RFQ.",
    dueAt: message?.request_due_at ?? null,
  });

  revalidatePath("/marketplace/rfq-hub/" + input.rfqId.trim());
  return { ok: true, warning: delivered.warning };
}
