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
