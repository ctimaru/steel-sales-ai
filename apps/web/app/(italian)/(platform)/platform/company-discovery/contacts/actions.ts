"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

/** NET-CONTACT1 — bulk review of public company channels (LR4, root-only). */
const path = "/platform/company-discovery/contacts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bounce(kind: "message" | "error", detail: string): never {
  redirect(path + "?" + kind + "=" + encodeURIComponent(detail));
}

function selectedIds(form: FormData): string[] {
  const ids = [...new Set(form.getAll("contact_id").map(String).filter((id) => UUID.test(id)))];
  if (!ids.length) bounce("error", "Seleziona almeno un contatto.");
  if (ids.length > 200) bounce("error", "Massimo 200 contatti per volta.");
  return ids;
}

export async function reviewCompanyChannels(form: FormData) {
  await requirePlatformSuperadmin();
  const ids = selectedIds(form);
  const decision = String(form.get("decision") ?? "");
  const supabase = await createClient();
  if (decision === "approve") {
    const { data, error } = await supabase.rpc("netcontact1_approve_company_channels", { p_contact_ids: ids });
    const out = data as { contract?: string; published?: number; skipped?: number } | null;
    if (error || out?.contract !== "netcontact1-approve-v1") bounce("error", "Approvazione non registrata. Nessun contatto pubblicato.");
    revalidatePath(path);
    revalidatePath("/network");
    bounce("message", `${out.published ?? 0} canali aziendali pubblicati come contatto aziendale (revisione valida 12 mesi). ${out.skipped ?? 0} saltati.`);
  }
  if (decision === "reject") {
    const { data, error } = await supabase.rpc("netcontact1_reject_company_channels", {
      p_contact_ids: ids, p_note: String(form.get("note") ?? "").trim().slice(0, 1000) || null,
    });
    const out = data as { contract?: string; rejected?: number } | null;
    if (error || out?.contract !== "netcontact1-reject-v1") bounce("error", "Scarto non registrato.");
    revalidatePath(path);
    bounce("message", `${out.rejected ?? 0} contatti scartati e archiviati. Non saranno pubblicati.`);
  }
  bounce("error", "Decisione non valida.");
}
