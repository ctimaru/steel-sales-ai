"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
const route = "/platform/company-discovery/geo-review/municipalities";

export async function stageMunicipalityMatch(data: FormData) {
  await requirePlatformPermission("discovery.enrich");
  const supabase = await createClient();
  const { error } = await supabase.rpc("netux3a_stage_facility_match", {
    p_facility_id: String(data.get("facility_id") ?? ""),
    p_province_code: String(data.get("province_code") ?? "").trim().toUpperCase(),
    p_source_url: String(data.get("source_url") ?? "").trim(),
    p_evidence_snippet: String(data.get("evidence_snippet") ?? "").trim(),
  });
  if (error) redirect(route+"?error="+encodeURIComponent("Nessun abbinamento ISTAT univoco documentato. Controlla fonte, comune, provincia e regione."));
  revalidatePath(route);
  redirect(route+"?message="+encodeURIComponent("Match proposto; serve approvazione Platform prima di usarlo."));
}

export async function decideMunicipalityMatch(data: FormData) {
  await requirePlatformPermission("discovery.governance_review");
  await requirePlatformPermission("discovery.publish");
  const supabase = await createClient();
  const { error } = await supabase.rpc("netux3a_decide_facility_match", {
    p_review_id: String(data.get("review_id") ?? ""),
    p_decision: String(data.get("decision") ?? ""),
    p_note: String(data.get("note") ?? "").trim(),
  });
  if (error) redirect(route+"?error="+encodeURIComponent("Revisione non registrata. Verifica ruolo, fonte ufficiale e correttezza della regione."));
  revalidatePath(route);
  revalidatePath("/network");
  redirect(route+"?message="+encodeURIComponent("Decisione ISTAT registrata. Nessuna sede o dato aziendale modificato."));
}
