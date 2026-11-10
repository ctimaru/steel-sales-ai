"use server";

import { revalidatePath } from "next/cache";

import { canWriteWorkspace } from "@/lib/access-policy";
import { DEAL_LABEL_MAX, normalizeDealLabel } from "@/lib/commercial-deal-label-text";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export type DealLabelState = { status: "idle" | "saved" | "error"; message: string };

const TABLES = { rfq: "rfqs", offer: "offers", order: "orders" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function renameCommercialDeal(
  _previous: DealLabelState,
  formData: FormData,
): Promise<DealLabelState> {
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!(kind in TABLES) || !UUID.test(id)) return { status: "error", message: "Trattativa non valida." };

  const context = await getWorkspaceContext();
  if (!canWriteWorkspace(context.role)) {
    return { status: "error", message: "Il tuo profilo non può rinominare le trattative." };
  }

  const raw = formData.get("label");
  if (typeof raw === "string" && raw.trim().length > DEAL_LABEL_MAX) {
    return { status: "error", message: "Massimo " + DEAL_LABEL_MAX + " caratteri." };
  }
  const label = normalizeDealLabel(raw);

  const db = await createClient();
  // RLS limita comunque l'aggiornamento ai membri con scrittura dell'organizzazione.
  const { data, error } = await db.from(TABLES[kind as keyof typeof TABLES])
    .update({ deal_label: label })
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: "Non è stato possibile salvare il nome." };

  revalidatePath(appRoutes.commercial.home);
  return { status: "saved", message: label ? "Nome salvato." : "Nome rimosso." };
}
