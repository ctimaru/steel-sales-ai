"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {createClient} from "@/lib/supabase/server";

const route="/platform/company-discovery/market-review";

export async function decideMarketEvidence(form:FormData){
 await requirePlatformPermission("discovery.enrich");
 const decision=String(form.get("decision")||"");
 const id=String(form.get("id")||"");
 if(!/^[a-f0-9-]{36}$/i.test(id)||!["accept","reject"].includes(decision)){
   redirect(route+"?error=Richiesta%20non%20valida");
 }
 const supabase=await createClient();
 const {error}=await supabase.rpc("netdata1c_review_market",{
   p_id:id,p_accept:decision==="accept",
 });
 if(error)redirect(route+"?error="+encodeURIComponent("Decisione non registrata. Controlla i permessi e la fonte."));
 revalidatePath(route);revalidatePath("/network");
 redirect(route+"?message="+encodeURIComponent(
  "Decisione sul settore registrata. Non verifica l'azienda né la qualifica come acquirente."
 ));
}
