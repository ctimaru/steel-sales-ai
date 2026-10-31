"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {createClient} from "@/lib/supabase/server";

const ROOT="/platform/company-discovery/product-evidence";
const allowedRoles=[
 "unclassified","tube_producer","trader_distributor",
 "processor_service_provider","end_user","tube_machinery_maker",
 "finished_equipment_maker",
] as const;
const safeLane=(v:FormDataEntryValue|null)=>
 ["canonical","provisional"].includes(String(v??""))?String(v):"all";
function returnPath(lane:string,page:number,param:"error"|"message",message:string){
 return ROOT+"?lane="+lane+"&page="+page+"&"+param+"="+encodeURIComponent(message);
}

export async function recordProductEvidenceReview(formData:FormData){
 await requirePlatformPermission("discovery.review");
 const lane=safeLane(formData.get("lane"));
 const pageRaw=String(formData.get("page")??"1");
 const page=/^\d{1,3}$/.test(pageRaw)?Math.max(1,Math.min(Number(pageRaw),400)):1;
 const evidenceId=String(formData.get("evidence_id")??"");
 const decision=String(formData.get("decision")??"");
 const reason=String(formData.get("reason")??"").trim();
 const role=String(formData.get("reviewer_role")??"unclassified");
 const identity=formData.get("identity_confirmed")==="on";
 const rights=formData.get("source_rights_confirmed")==="on";
 const attribute=formData.get("attribute_confirmed")==="on";
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evidenceId)
   || !["accepted","hold","rejected"].includes(decision)
   || !allowedRoles.some(k=>k===role)
   || reason.length<20||reason.length>1000){
   redirect(returnPath(lane,page,"error","Revisione non valida: controlla motivazione e campi."));
 }
 if(decision==="accepted"){
  await requirePlatformPermission("discovery.enrich");
  if(role==="unclassified"||!identity||!rights||!attribute){
   redirect(returnPath(lane,page,"error","L'approvazione richiede identità, fonte, diritti e prodotto confermati."));
  }
 }
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netgrowth2c3_record_product_review",{
  p_evidence_id:evidenceId,p_decision:decision,p_reason:reason,p_role:role,
  p_identity_confirmed:identity,p_source_rights_confirmed:rights,
  p_attribute_confirmed:attribute,
 });
 if(error||(data as {publication_performed?:boolean}|null)?.publication_performed!==false){
   redirect(returnPath(lane,page,"error","Revisione non registrata. Controlla permessi e fonte."));
 }
 revalidatePath(ROOT);
 redirect(returnPath(lane,page,"message",
  "Decisione registrata nello storico privato. Nessuna pubblicazione effettuata."));
}
