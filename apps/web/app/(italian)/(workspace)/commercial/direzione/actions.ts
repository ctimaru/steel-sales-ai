"use server";

import { revalidatePath } from "next/cache";

import { decideRfqh13Approval } from "@/app/(workspace)/marketplace/rfq-hub/[rfqId]/governance-actions";
import { canAdministerCompany } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

// DIR-DESK1 — azioni della Scrivania della Direzione. Solo amministratori
// dell'azienda. L'assegnazione scrive solo assigned_to_user_id del documento di
// partenza della trattativa; RLS e i trigger validate_*_membership_users
// verificano di nuovo che la persona appartenga all'azienda.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLES = { "inbound-rfq": "rfqs", "inbound-offer": "offers", "inbound-order": "orders" } as const;
type AssignableKind = keyof typeof TABLES;

export type DeskActionResult = { ok: true } | { ok: false; error: string };

export async function assignDeskDeal(input: { kind: string; id: string; userId: string | null }): Promise<DeskActionResult> {
  const context = await getWorkspaceContext();
  if (!canAdministerCompany(context.role)) return { ok: false, error: "Solo la Direzione aziendale assegna le pratiche." };
  const table = TABLES[input.kind as AssignableKind];
  if (!table || !UUID.test(input.id) || (input.userId !== null && !UUID.test(input.userId))) {
    return { ok: false, error: "Pratica o persona non valida." };
  }

  const db = await createClient();
  if (input.userId) {
    const { data: member } = await db.from("organization_memberships").select("user_id,role,status")
      .eq("organization_id", context.organizationId).eq("user_id", input.userId).maybeSingle();
    const row = member as { role?: string; status?: string } | null;
    if (!row || row.status !== "active" || row.role === "viewer") {
      return { ok: false, error: "La persona scelta non è attiva nel team o ha accesso in sola lettura." };
    }
  }

  const { data, error } = await db.from(table).update({ assigned_to_user_id: input.userId })
    .eq("organization_id", context.organizationId).eq("id", input.id).select("id");
  if (error) return { ok: false, error: "Assegnazione non riuscita: la pratica potrebbe essere bloccata. Aprila e riprova." };
  if (!data?.length) return { ok: false, error: "Pratica non trovata o non modificabile con il tuo accesso." };

  revalidatePath(appRoutes.commercial.direction);
  revalidatePath(appRoutes.commercial.home);
  return { ok: true };
}

export async function decideDeskApproval(input: {
  rfqId: string; approvalId: string; decision: "approved" | "rejected"; note?: string | null;
}): Promise<DeskActionResult> {
  const context = await getWorkspaceContext();
  if (!canAdministerCompany(context.role)) return { ok: false, error: "Solo la Direzione aziendale decide da qui." };
  if (!UUID.test(input.rfqId) || !UUID.test(input.approvalId) || !["approved", "rejected"].includes(input.decision)) {
    return { ok: false, error: "Approvazione non valida." };
  }
  // Stesse regole della pagina RFQ: il database rifiuta chi approva la propria richiesta.
  const result = await decideRfqh13Approval(input);
  if (!result.ok) return { ok: false, error: result.error ?? "Decisione non registrata." };
  revalidatePath(appRoutes.commercial.direction);
  return { ok: true };
}
