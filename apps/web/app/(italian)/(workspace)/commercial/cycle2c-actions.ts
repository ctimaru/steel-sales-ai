"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { canWriteWorkspace } from "@/lib/access-policy";
import {
  buildCustomerOfferEmail, customerOfferEmailReady, validCustomerEmailRecipient,
  type CustomerOfferEmailSnapshot,
} from "@/lib/comm-cycle2c-email";
import { UUID_V4ISH } from "@/lib/comm-cycle2b-pricing";
import { officeWriteDenied } from "@/lib/office-profile-guard";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export type CustomerOfferSendState = {
  status: "idle" | "sent" | "error" | "unknown";
  message: string;
};
const failure = (message: string): CustomerOfferSendState => ({ status: "error", message });

function explanation(message: string | undefined) {
  const m = message?.match(/comm_cycle2c: ([^\n]+)/);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1) + ".";
  if (message?.includes("office_profile_read_only")) return "Serve l'Ufficio commerciale o la Direzione.";
  return "Non è stato possibile completare l'invio. Controlla lo storico prima di riprovare.";
}

/** Only a user-confirmed server action sends. No scheduler, webhook or bulk
 * recipient list. The provider token never enters a client component. */
export async function sendCustomerOfferEmail(
  _previous: CustomerOfferSendState, form: FormData,
): Promise<CustomerOfferSendState> {
  const rfqId = String(form.get("rfq_id") ?? "");
  const offerId = String(form.get("offer_id") ?? "");
  const version = Number(form.get("version"));
  const recipient = String(form.get("recipient") ?? "").trim().toLowerCase();
  const subject = String(form.get("subject") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!UUID_V4ISH.test(rfqId) || !UUID_V4ISH.test(offerId)
    || !Number.isSafeInteger(version) || version < 0)
    return failure("Richiesta o revisione non valida.");
  if (form.get("verified_recipient") !== "yes" || !validCustomerEmailRecipient(recipient))
    return failure("Conferma esplicitamente l'indirizzo email del cliente.");
  if (subject.length < 1 || subject.length > 180 || /[\r\n]/.test(subject)
    || message.length > 2000)
    return failure("Oggetto o messaggio non valido.");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return failure("Il canale email non è configurato: nessun invio avviato.");

  const scope = await getWorkspaceContext();
  if (!canWriteWorkspace(scope.role)) return failure("Il tuo ruolo non consente l'invio.");
  const denied = await officeWriteDenied("commercial");
  if (denied) return failure(denied);

  const db = await createClient();
  const { data: offer, error: offerError } = await db.from("offers")
    .select("id,rfq_id,company_id,status,revision_no,revision_managed,draft_edit_version,valid_until,delivery_term,payment_terms")
    .eq("organization_id",scope.organizationId).eq("id",offerId).maybeSingle();
  if (offerError || !offer || offer.rfq_id !== rfqId || !offer.revision_managed
    || offer.status !== "draft" || offer.draft_edit_version !== version)
    return failure("Bozza non aggiornata. Ricarica prima dell'invio.");

  const { data: rows, error: rowError } = await db.from("offer_lines")
    .select("id,raw_spec_text,quantity,quantity_unit,price_value,price_unit,weight_kg_m")
    .eq("organization_id",scope.organizationId).eq("offer_id",offerId)
    .order("created_at",{ascending:true}).limit(101);
  if (rowError || !rows || rows.length > 100)
    return failure("Righe offerta non disponibili o troppo numerose.");

  let clientName: string | null = null;
  if (offer.company_id) {
    const { data: company } = await db.from("companies")
      .select("name").eq("organization_id",scope.organizationId)
      .eq("id",offer.company_id).maybeSingle();
    clientName = company?.name ?? null;
  }
  const snapshot: CustomerOfferEmailSnapshot = {
    seller: scope.organizationName, client: clientName,
    revision: offer.revision_no,
    validUntil: offer.valid_until ?? "",
    delivery: offer.delivery_term ?? "",
    payment: offer.payment_terms ?? "",
    lines: rows.map(row => ({
      description: row.raw_spec_text ?? "",
      quantity: row.quantity === null ? null : Number(row.quantity),
      quantityUnit: row.quantity_unit ?? "",
      rate: row.price_value === null ? "" : String(row.price_value),
      unit: row.price_unit === "EUR/m" ? "EUR/m" as const : "EUR/t" as const,
      weight: row.weight_kg_m === null ? "" : String(row.weight_kg_m),
    })),
  };
  if (!customerOfferEmailReady(snapshot)) {
    return failure("Completa prezzi e condizioni, poi salva la bozza prima di inviare.");
  }

  const email = buildCustomerOfferEmail(snapshot,subject,message);
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ recipient, subject:email.subject,html:email.html,text:email.text }))
    .digest("hex");

  // Durable reservation is an atomic cross-tab lock + per-revision send ledger.
  // If a response is lost after provider acceptance, we never blindly resend.
  const { data: booking, error: bookError } = await db.rpc("comm_cycle2c_reserve_email",{
    p_organization_id:scope.organizationId,p_offer_id:offerId,
    p_expected_version:version,p_recipient:recipient,p_subject:email.subject,
    p_content_sha256:contentHash,
  });
  if (bookError) return failure(explanation(bookError.message));
  const dispatchId = (booking as {dispatch_id?:unknown}|null)?.dispatch_id;
  if (typeof dispatchId !== "string" || !UUID_V4ISH.test(dispatchId)) {
    return {status:"unknown",message:"Invio prenotato ma non verificabile. Controlla lo storico; non riprovare automaticamente."};
  }

  let outcome: "accepted" | "failed" | "unknown" = "unknown";
  let providerMessageId: string | null = null;
  try {
    const sender = process.env.COMMERCIAL_EMAIL_FROM
      || "Smart Steel Sales <offerte@smartsteelsales.com>";
    const replyTo = process.env.COMMERCIAL_EMAIL_REPLY_TO;
    const response = await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{
        Authorization:"Bearer " + apiKey,
        "Content-Type":"application/json",
        "Idempotency-Key":"comm-cycle2c-" + dispatchId,
      },
      body:JSON.stringify({
        from:sender,to:[recipient],subject:email.subject,html:email.html,text:email.text,
        ...(replyTo ? {reply_to:[replyTo]} : {}),
        tags:[{name:"category",value:"commercial_offer"}],
      }),
      cache:"no-store",signal:AbortSignal.timeout(12000),
    });
    if (response.ok) {
      const data = (await response.json().catch(()=>null)) as {id?:unknown}|null;
      if (typeof data?.id === "string" && data.id.length >= 8 && data.id.length <= 128) {
        outcome = "accepted"; providerMessageId = data.id;
      }
    } else if (response.status < 500 && response.status !== 408 && response.status !== 429) {
      // A definitive 4xx rejection can be retried only by an explicit human action.
      outcome = "failed";
    }
  } catch {
    // A timeout/network loss is ambiguous: Resend might already have accepted.
    // No automatic retry, no provider response body or recipient in logs.
    outcome = "unknown";
  }

  const {error: finishError} = await db.rpc("comm_cycle2c_complete_email",{
    p_organization_id:scope.organizationId,p_dispatch_id:dispatchId,
    p_result:outcome,p_provider_message_id:providerMessageId,
  });
  revalidatePath(appRoutes.commercial.rfq(rfqId));
  revalidatePath(appRoutes.commercial.home);
  if (finishError) {
    return {status:"unknown",
      message:"Esito del provider non riconciliato nello storico. Non reinviare: verifica l'invio prima."};
  }
  if (outcome === "accepted") return {
    status:"sent", message:"Offerta inviata al provider email e revisione registrata come inviata."
  };
  if (outcome === "failed") return {
    status:"error", message:"Invio rifiutato dal provider. L'offerta resta in bozza; verifica il mittente e riprova solo dopo controllo."
  };
  return {status:"unknown",
    message:"Esito email incerto. La bozza è bloccata per evitare duplicati; verifica lo storico prima di procedere."};
}
