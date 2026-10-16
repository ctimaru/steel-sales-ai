"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {createClient} from "@/lib/supabase/server";
const route="/platform/company-discovery/geo-review";
export async function decideGeoEvidence(form:FormData) {
 await requirePlatformPermission("discovery.governance_review");
 const supabase=await createClient();
 const {error}=await supabase.rpc("crawl_it61_review_geo_evidence",{
 p_id:String(form.get("id")??""),
 p_decision:String(form.get("decision")??""),
 p_note:String(form.get("note")??"").trim()
 });
 if(error) redirect(route+"?error="+encodeURIComponent("Revisione non salvata. Verifica autorizzazioni e motivazione."));
 revalidatePath(route);
 redirect(route+"?message="+encodeURIComponent("Decisione registrata. Nessuna sede pubblicata automaticamente."));
}


/** NET-UX3: source capture is a staging operation, never publication. */
export async function stageOfficialGeoEvidence(form: FormData) {
  await requirePlatformPermission("discovery.enrich");
  const supabase = await createClient();
  const { error } = await supabase.rpc("netux3_stage_official_geo", {
    p_company_id: String(form.get("company_id") ?? ""),
    p_source_url: String(form.get("source_url") ?? "").trim(),
    p_city: String(form.get("city") ?? "").trim(),
    p_region: String(form.get("region") ?? "").trim(),
    p_evidence_snippet: String(form.get("evidence_snippet") ?? "").trim(),
  });
  if (error) redirect(route + "?error=" + encodeURIComponent("Evidenza non salvata: fonte ufficiale, identità, città e regione devono essere documentate."));
  revalidatePath(route);
  redirect(route + "?message=" + encodeURIComponent("Evidenza salvata nella coda. Nessuna sede pubblicata."));
}

/** NET-UX3: explicit second decision, with platform permission rechecked by RPC. */
export async function publishReviewedGeoEvidence(form: FormData) {
  await requirePlatformPermission("discovery.publish");
  await requirePlatformPermission("discovery.governance_review");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netux3_publish_reviewed_geo", {
    p_evidence_id: String(form.get("evidence_id") ?? ""),
    p_publication_note: String(form.get("publication_note") ?? "").trim(),
  });
  if (error || !data) redirect(route + "?error=" + encodeURIComponent("Sede non pubblicata. Controlla il secondo gate di revisione."));
  revalidatePath(route);
  revalidatePath("/network");
  redirect(route + "?message=" + encodeURIComponent("Sede pubblicata con tracciabilità e stato non verificato. La mappa verrà aggiornata."));
}

/** NET-UX3B: evidence-first ISTAT staging. The backend derives the region;
 * no facility, Company Memory or crawler candidate is promoted. */
export async function stageOfficialGeoWithIstat(form: FormData) {
  await requirePlatformPermission("discovery.enrich");
  const supabase = await createClient();
  const { error, data } = await supabase.rpc("netux3b_operator_stage_geo", {
    p_company_id: String(form.get("company_id") ?? ""),
    p_source_url: String(form.get("source_url") ?? "").trim(),
    p_city: String(form.get("city") ?? "").trim(),
    p_province_code: String(form.get("province_code") ?? "").trim().toUpperCase(),
    p_evidence_snippet: String(form.get("evidence_snippet") ?? "").trim(),
  });
  if (error || !data) redirect(route + "?error=" + encodeURIComponent(
    "Proposta non salvata: verifica dominio ufficiale, estratto città (provincia) e corrispondenza ISTAT unica."
  ));
  revalidatePath(route);
  redirect(route + "?message=" + encodeURIComponent(
    "Evidenza registrata per revisione. Nessuna località pubblicata automaticamente."
  ));
}


/** NET-UX3B.1: authenticated human-only recovery from an accidentally
 * selected conflict. Source and prior reviewer decision stay in audit ledger. */
export async function reopenConflictEvidence(form: FormData) {
  await requirePlatformPermission("discovery.governance_review");
  const supabase = await createClient();
  const { error } = await supabase.rpc("netux3b1_reopen_conflict", {
    p_evidence_id: String(form.get("evidence_id") ?? ""),
    p_note: String(form.get("note") ?? "").trim(),
  });
  if (error) redirect(route+"?error="+encodeURIComponent(
    "Non è stato possibile riaprire il conflitto. Verifica sessione e motivazione."
  ));
  revalidatePath(route);
  redirect(route+"?message="+encodeURIComponent(
    "Conflitto riaperto e registrato nel ledger. Richiede nuova approvazione separata."
  ));
}
