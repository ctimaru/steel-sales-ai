"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {createClient} from "@/lib/supabase/server";
import {parseLicensedCompanies} from "@/lib/network-licensed-import";

const path="/platform/company-discovery/bulk";
function bounce(kind:"message"|"error",detail:string):never{
 redirect(path+"?"+kind+"="+encodeURIComponent(detail));
}
export async function grantLicensedSource(form:FormData){
 await requirePlatformPermission("discovery.governance_review");
 const date=String(form.get("expires_at")??"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))
  bounce("error","Inserisci una data di scadenza valida.");
 const {data,error}=await (await createClient()).rpc("netfast3_grant_feed",{
  p_source_id:String(form.get("source_id")??""),
  p_license_url:String(form.get("license_url")??"").trim(),
  p_note:String(form.get("note")??"").trim(),
  p_expires_at:date+"T23:59:59Z",
  p_attested:form.get("attested")==="yes",
 });
 if(error||(data as {status?:string}|null)?.status!=="feed_approved_for_structured_import_only")
  bounce("error","Fonte non autorizzata: prima completa la review della licenza di riutilizzo esterno nella console Fonti.");
 revalidatePath(path);
 bounce("message","Fonte abilitata per import di dati strutturati; nessun crawler web attivato.");
}
export async function importLicensedDataset(form:FormData){
 await requirePlatformPermission("discovery.enrich");
 const file=form.get("file");
 const text=String(form.get("rows")??"");
 if(file instanceof File && file.size>450_000)
  bounce("error","Il file supera 450 KB: suddividilo in lotti da 1.000.");
 const raw=file instanceof File&&file.size>0 ? await file.text() : text;
 let items;
 try{items=parseLicensedCompanies(raw);}
 catch(e){bounce("error",e instanceof Error?e.message:"Formato CSV o Excel TSV non valido.");}
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netfast3_bulk_import",{
  p_source_id:String(form.get("source_id")??""),
  p_campaign:String(form.get("campaign")??"").trim(),
  p_items:items,
 });
 const stats=data as {contract?:string;added_unconfirmed?:number;duplicate?:number;skipped?:number}|null;
 if(error||stats?.contract!=="netfast3-batch-v1")
  bounce("error","Import negato: verifica che la fonte abbia una licenza valida per la visualizzazione nel SaaS.");
 revalidatePath(path);
 revalidatePath("/network");
 bounce("message",`Import completato: ${stats.added_unconfirmed??0} nuove schede da confermare, ${stats.duplicate??0} duplicati, ${stats.skipped??0} scartate. Nessuna pubblicazione verificata.`);
}
export async function revokeLicensedSource(form:FormData){
 await requirePlatformPermission("discovery.governance_review");
 const {data,error}=await (await createClient()).rpc("netfast3_revoke_feed",{
  p_source_id:String(form.get("source_id")??""),
  p_reason:String(form.get("reason")??"").trim(),
 });
 if(error||(data as {status?:string}|null)?.status!=="feed_revoked")
  bounce("error","Revoca non registrata: controlla fonte e motivazione.");
 revalidatePath(path);bounce("message","Fonte revocata: i profili importati non vengono più mostrati.");
}
export async function suppressLicensedDomain(form:FormData){
 await requirePlatformPermission("discovery.governance_review");
 const {data,error}=await (await createClient()).rpc("netfast3_suppress_domain",{
  p_domain:String(form.get("domain")??"").trim().toLowerCase(),
  p_reason:String(form.get("reason")??"").trim(),
 });
 if(error||(data as {status?:string}|null)?.status!=="suppressed")
  bounce("error","Rimozione non riuscita: verifica dominio e motivazione.");
 revalidatePath(path);bounce("message","Dominio escluso dalle schede scoperte e dai futuri import.");
}
