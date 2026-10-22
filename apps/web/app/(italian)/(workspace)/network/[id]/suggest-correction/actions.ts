"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

// IDs and organization context are re-checked by the SQL RPC; the browser cannot assign claims.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function value(formData: FormData,key: string) {
  const item=formData.get(key);
  return typeof item==="string" ? item.trim() : "";
}

export async function submitItalianIdentityCorrection(formData: FormData) {
  const context=await requireWorkspaceAdmin();
  const discoveryId=value(formData,"discovery_id");
  if (!UUID.test(discoveryId)) redirect("/network");
  const returnPath="/network/"+encodeURIComponent(discoveryId)+"/suggest-correction";
  const field=value(formData,"field_key");
  const proposed=value(formData,"proposed_value");
  const source=value(formData,"source_url");
  const note=value(formData,"evidence_note");
  const representation=value(formData,"representation_basis");
  const accepted=value(formData,"proposal_acknowledged")==="yes";

  if (!accepted || !["company_name","website_domain","location","brand_group"].includes(field)
     || !["industry_observer","self_declared_representative"].includes(representation)
     || proposed.length<4 || proposed.length>180 || note.length<30 || note.length>800
     || source.length<12 || source.length>500 || !source.startsWith("https://")) {
    redirect(returnPath+"?error=invalid");
  }

  const supabase=await createClient();
  const {data,error}=await supabase.rpc("netit_identity2d2_submit_correction",{
    p_discovery_id:discoveryId,
    p_organization_id:context.organizationId,
    p_field:field,
    p_proposed_value:proposed,
    p_source_url:source,
    p_evidence_note:note,
    p_representation:representation,
  });
  const receipt=data as {contract?:string;status?:string;published?:boolean;claim_granted?:boolean}|null;
  if(error || receipt?.contract!=="netit-identity2d2-v1"
    || receipt.status!=="submitted" || receipt.published!==false
    || receipt.claim_granted!==false) {
    // No raw DB exception, private relationship or tenant metadata in the URL.
    redirect(returnPath+"?error=unavailable");
  }
  revalidatePath("/network/"+discoveryId);
  redirect(returnPath+"?submitted=1");
}
