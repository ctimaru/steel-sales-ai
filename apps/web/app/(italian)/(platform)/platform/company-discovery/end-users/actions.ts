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
