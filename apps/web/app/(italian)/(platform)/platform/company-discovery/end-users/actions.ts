"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {createClient} from "@/lib/supabase/server";

const path="/platform/company-discovery/end-users";
const msg=(kind:"message"|"error",text:string)=>path+"?"+kind+"="+encodeURIComponent(text);

export async function stageEndUserTarget(form:FormData){
 await requirePlatformPermission("discovery.enrich");
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netcov1_operator_stage",{
   p_name:String(form.get("company_name")??"").trim(),
   p_domain:String(form.get("domain")??"").trim().toLowerCase(),
   p_evidence_url:String(form.get("evidence_url")??"").trim(),
   p_evidence_summary:String(form.get("summary")??"").trim(),
   p_segment:String(form.get("segment")??""),
   p_material_signal:String(form.get("material_signal")??""),
   p_role:String(form.get("role")??""),
 });
 if(error||!data)redirect(msg("error","Fonte non inserita: controlla dominio ufficiale, dati aziendali ed evidenza del prodotto."));
 revalidatePath(path);
 redirect(msg("message","Lead registrato nel bacino di ricerca, non nella directory pubblicata."));
}

export async function reviewEndUserTargets(form:FormData){
 await requirePlatformPermission("discovery.governance_review");
 const ids=form.getAll("target_ids").map(String).filter(Boolean);
 if(!ids.length||ids.length>40)redirect(msg("error","Seleziona da 1 a 40 aziende."));
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netcov1_review_targets",{
   p_target_ids:ids,
   p_decision:String(form.get("decision")??""),
   p_note:String(form.get("note")??"").trim(),
   p_attested:form.get("attested")==="yes",
 });
 if(error||!data)redirect(msg("error","Revisione del lotto rifiutata: ricontrolla stato, fonte, ruolo e attestazione."));
 revalidatePath(path);
 redirect(msg("message","Qualificazione del lotto registrata. Nessun profilo pubblicato."));
}

export async function enqueueEndUserTargets(form:FormData){
 await requirePlatformPermission("discovery.run");
 await requirePlatformPermission("discovery.governance_review");
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netcov1_enqueue_reviewed",{
   p_source_id:String(form.get("source_id")??""),
   p_limit:Number(form.get("limit")??40),
 });
 if(error||!data)redirect(msg("error","Fonte non abilitata: serve approvazione documentata dei diritti prima del trasferimento."));
 revalidatePath(path);
 revalidatePath("/platform/company-discovery");
 redirect(msg("message","Lead inoltrati alla coda Discovery in attesa di revisione, senza scansioni o pubblicazioni automatiche."));
}

/**
 * NET-COV2: paste a cohort directly from a spreadsheet (TSV, seven columns).
 * This is research staging only: no source rights, crawler run or publication.
 */
export async function stageIndustrialCampaign(form:FormData){
 await requirePlatformPermission("discovery.enrich");
 const campaign=String(form.get("campaign")??"").trim();
 const raw=String(form.get("rows")??"");
 const rows=raw.replace(/\r/g,"").split("\n").map(r=>r.trim()).filter(Boolean);
 const header="name\tdomain\tevidence_url\tsummary\tsegment\tmaterial_signal\trole";
 if(rows[0]?.toLowerCase()===header)rows.shift();
 if(rows.length<1||rows.length>40||raw.length>60000)
  redirect(msg("error","Importa da 1 a 40 righe per campagna (massimo 60.000 caratteri)."));
 const items=rows.map(row=>{
  const parts=row.split("\t").map(x=>x.trim());
  return parts.length===7&&parts.every(Boolean)?{
   name:parts[0],domain:parts[1],evidence_url:parts[2],summary:parts[3],
   segment:parts[4],material_signal:parts[5],role:parts[6],
  }:null;
 });
 if(items.some(item=>item===null))
  redirect(msg("error","Ogni riga deve avere esattamente 7 colonne TAB, senza campi vuoti."));
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netcov2_operator_batch_stage",{
  p_items:items,p_campaign:campaign,p_attested:form.get("attested")==="yes",
 });
 if(error||!data||data.contract!=="netcov2-stage-v1")
  redirect(msg("error","Import non accettato: verifica dominio/evidenza ufficiale, campagna e autorizzazione Platform."));
 revalidatePath(path);
 redirect(msg("message",`Campagna importata: ${data.staged_needs_review} in review, ${data.duplicate_existing} duplicati, ${data.already_staged} già presenti. Nessuna scansione o pubblicazione.`));
}
