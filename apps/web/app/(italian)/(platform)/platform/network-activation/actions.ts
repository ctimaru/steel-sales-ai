"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {createClient} from "@/lib/supabase/server";
import {safeErrorMessage} from "@/lib/user-facing-error";
function txt(form:FormData,key:string){return String(form.get(key)??"").trim();}
const path=(kind:"message"|"error",message:string)=>"/platform/network-activation?"+kind+"="+encodeURIComponent(message)+"#claim-reconciliation";
export async function reviewProvisionalReconciliation(formData:FormData){
 const requestId=txt(formData,"request_id");
 const decision=txt(formData,"decision");
 const note=txt(formData,"note");
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-f0-9]{12}$/i.test(requestId)||
    !["under_review","rejected","ready_for_claim"].includes(decision))
   redirect(path("error","Richiesta o decisione non valida."));
 const permission=decision==="ready_for_claim"?"claims.approve":decision==="rejected"?"claims.reject":"claims.review_proof";
 await requirePlatformPermission(permission);
 if(note.length<10||note.length>2000)
   redirect(path("error","La decisione richiede una motivazione da 10 a 2000 caratteri."));
 const supabase=await createClient();
 const {error}=await supabase.rpc("netgrowth3g3_review_reconciliation",{
  p_request_id:requestId,p_decision:decision,p_note:note
 });
 if(error)redirect(path("error",safeErrorMessage(error,"Revisione non completata. Verifica registrazione e prove di identità.")));
 revalidatePath("/platform/network-activation");
 revalidatePath("/network");
 redirect(path("message",decision==="ready_for_claim"
   ?"Corrispondenza approvata: ora serve il claim canonico, senza assegnazioni automatiche."
   :decision==="rejected"?"Richiesta respinta con motivazione.":"Richiesta presa in revisione."));
}
