"use server";

import { revalidatePath } from "next/cache";

import { canWriteWorkspace } from "@/lib/access-policy";
import { normalizeQuoteLines, UUID_V4ISH } from "@/lib/comm-cycle2b-pricing";
import { officeWriteDenied } from "@/lib/office-profile-guard";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export type QuoteActionState = { status: "idle" | "saved" | "error"; message: string };
const bad = (message: string): QuoteActionState => ({ status: "error", message });

function friendly(message: string | undefined): string {
  const text = message ?? "";
  if (text.includes("office_profile_read_only")) return "Serve il profilo Ufficio commerciale o Direzione.";
  const match = text.match(/comm_cycle2[ab]: ([^\n]+)/);
  if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return "Non è stato possibile salvare. Riprova o verifica i permessi.";
}

async function writeAccess(): Promise<{ organizationId: string } | { error: string }> {
  const context = await getWorkspaceContext();
  if (!canWriteWorkspace(context.role)) return { error: "Il tuo ruolo non permette modifiche." };
  const denied = await officeWriteDenied("commercial");
  if (denied) return { error: denied };
  return { organizationId: context.organizationId };
}

export async function prepareCustomerOffer(
  _previous: QuoteActionState, formData: FormData,
): Promise<QuoteActionState> {
  const rfqId = String(formData.get("rfq_id") ?? "");
  if (!UUID_V4ISH.test(rfqId)) return bad("Richiesta non valida.");
  const scope = await writeAccess();
  if ("error" in scope) return bad(scope.error);
  const db = await createClient();
  const { data, error } = await db.rpc("comm_cycle2a_prepare_offer", {
    p_organization_id: scope.organizationId,
    p_rfq_id: rfqId,
  });
  if (error) return bad(friendly(error.message));
  revalidatePath(appRoutes.commercial.home);
  revalidatePath(appRoutes.commercial.rfq(rfqId));
  return { status: "saved", message: (data as { created?: boolean })?.created === false
    ? "Bozza già presente: puoi completarla qui."
    : "Bozza preparata con le righe della richiesta." };
}

export async function saveCustomerOffer(
  _previous: QuoteActionState, formData: FormData,
): Promise<QuoteActionState> {
  const rfqId = String(formData.get("rfq_id") ?? "");
  const offerId = String(formData.get("offer_id") ?? "");
  const version = Number(formData.get("version"));
  if (!UUID_V4ISH.test(rfqId) || !UUID_V4ISH.test(offerId)
    || !Number.isSafeInteger(version) || version < 0) return bad("Offerta o versione non valida.");

  const raw = formData.get("lines");
  if (typeof raw !== "string" || raw.length > 25000) return bad("Le righe non sono valide.");
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return bad("Le righe non sono leggibili."); }
  const normalized = normalizeQuoteLines(json);
  if (!normalized.ok) return bad(normalized.message);

  const validity = String(formData.get("valid_until") ?? "").trim();
  if (validity && !/^\d{4}-\d{2}-\d{2}$/.test(validity)) return bad("Data di validità non valida.");
  const delivery = String(formData.get("delivery_term") ?? "").trim();
  const payment = String(formData.get("payment_terms") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (delivery.length > 200 || payment.length > 200 || notes.length > 500) {
    return bad("Le condizioni superano la lunghezza consentita.");
  }
  const scope = await writeAccess();
  if ("error" in scope) return bad(scope.error);

  const db = await createClient();
  // The DB guards the latest editable draft and exact line membership under
  // one lock. The request ID is only the route to revalidate, not an ACL input.
  const { error } = await db.rpc("comm_cycle2b_save_offer", {
    p_organization_id: scope.organizationId,
    p_offer_id: offerId,
    p_expected_version: version,
    p_valid_until: validity || null,
    p_delivery_term: delivery || null,
    p_payment_terms: payment || null,
    p_notes: notes || null,
    p_lines: normalized.lines,
  });
  if (error) return bad(friendly(error.message));
  revalidatePath(appRoutes.commercial.home);
  revalidatePath(appRoutes.commercial.rfq(rfqId));
  revalidatePath(appRoutes.commercial.offer(offerId));
  return { status: "saved", message: "Bozza salvata. Nessuna offerta è stata inviata al cliente." };
}
