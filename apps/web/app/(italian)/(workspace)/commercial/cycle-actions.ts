"use server";

import { revalidatePath } from "next/cache";

import { canWriteWorkspace } from "@/lib/access-policy";
import { isCloseReason } from "@/lib/commercial-cycle";
import { officeWriteDenied } from "@/lib/office-profile-guard";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export type CycleActionState = { status: "idle" | "done" | "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORDS = ["rfq", "offer", "order", "campaign"] as const;
const ACTIONS = ["take_charge", "offer_sent", "offer_accepted", "order_registered", "order_confirmed", "order_status", "close_lost", "reopen"] as const;
const ORDER_STATUSES = ["in_production", "ready", "shipped", "delivered"] as const;

const DONE: Record<(typeof ACTIONS)[number], string> = {
  take_charge: "Richiesta presa in carico.",
  offer_sent: "Offerta segnata come inviata.",
  offer_accepted: "Offerta segnata come accettata.",
  order_registered: "Ordine registrato.",
  order_confirmed: "Ordine confermato.",
  order_status: "Stato dell'ordine aggiornato.",
  close_lost: "Trattativa chiusa come non conclusa.",
  reopen: "Trattativa riaperta.",
};

/** Messaggio leggibile dagli errori della funzione SQL (prefisso «comm_cycle1:»). */
function friendly(message: string | undefined): string {
  const text = message ?? "";
  if (text.includes("office_profile_read_only")) {
    return text.includes("acquisti")
      ? "Il tuo profilo consulta gli acquisti in sola lettura: serve il profilo Ufficio acquisti."
      : "Il tuo profilo consulta le vendite in sola lettura: serve il profilo Ufficio commerciale.";
  }
  const match = text.match(/comm_cycle1: ([^\n]+)/);
  if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1) + ".";
  return "Non è stato possibile completare l'azione. Riprova.";
}

/**
 * COMM-CYCLE1 — unica azione server per prendere in carico, segnare l'offerta,
 * registrare/confermare/avanzare l'ordine, chiudere come non conclusa e riaprire.
 * Controlli qui (ruolo, profilo d'ufficio, formato) e di nuovo nella funzione SQL.
 */
export async function applyDealCycleAction(_previous: CycleActionState, formData: FormData): Promise<CycleActionState> {
  const recordKind = String(formData.get("record_kind") ?? "");
  const recordId = String(formData.get("record_id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!(RECORDS as readonly string[]).includes(recordKind) || !UUID.test(recordId) || !(ACTIONS as readonly string[]).includes(action)) {
    return { status: "error", message: "Azione non valida." };
  }
  const toStatusRaw = String(formData.get("to_status") ?? "");
  const toStatus = (ORDER_STATUSES as readonly string[]).includes(toStatusRaw) ? toStatusRaw : null;
  if (action === "order_status" && !toStatus) return { status: "error", message: "Stato dell'ordine non valido." };
  const reasonRaw = formData.get("reason");
  const reason = action === "close_lost" ? (isCloseReason(reasonRaw) ? reasonRaw : null) : null;
  if (action === "close_lost" && !reason) return { status: "error", message: "Scegli il motivo." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  if (reason === "other" && !note) return { status: "error", message: "Con «Altro» scrivi una nota." };
  const orderRef = String(formData.get("customer_order_ref") ?? "").trim().slice(0, 80) || null;

  const context = await getWorkspaceContext();
  if (!canWriteWorkspace(context.role)) return { status: "error", message: "Il tuo ruolo consulta senza modificare." };
  const denied = await officeWriteDenied(recordKind === "campaign" ? "purchasing" : "commercial");
  if (denied) return { status: "error", message: denied };

  const db = await createClient();
  const { error } = await db.rpc("comm_cycle1_apply", {
    p_organization_id: context.organizationId,
    p_record_kind: recordKind,
    p_record_id: recordId,
    p_action: action,
    p_to_status: toStatus,
    p_reason: reason,
    p_note: action === "close_lost" ? note : null,
    p_customer_order_ref: action === "order_registered" ? orderRef : null,
  });
  if (error) return { status: "error", message: friendly(error.message) };

  revalidatePath(appRoutes.commercial.home);
  revalidatePath(appRoutes.rfqHub.home);
  if (recordKind === "campaign") revalidatePath(appRoutes.rfqHub.campaign(recordId));
  return { status: "done", message: DONE[action as (typeof ACTIONS)[number]] };
}
