import "server-only";

import {createClient} from "@/lib/supabase/server";

export type IdentityCorrectionResolution={
 id:string;
 field_key:"company_name"|"website_domain"|"location"|"brand_group";
 proposed_value:string;
 source_url:string;
 evidence_note:string;
 created_at:string;
 is_my_organization:boolean;
 resolution:"awaiting_owner"|"owner_supported"|"owner_disputed";
 decided_at:string|null;
 can_attest:boolean;
};
export type IdentityCorrectionQueue={
 contract:"netit-identity2d3-v1";
 owner_attestation_eligible:boolean;
 claim_target_company_id:string|null;
 total_visible:number;
 items:IdentityCorrectionResolution[];
 changes_published:0;
 legal_identity_verifications:0;
 new_claims:0;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getItalianCorrectionQueue(
 organizationId:string,discoveryId:string,
):Promise<IdentityCorrectionQueue|null> {
 if(!UUID.test(organizationId)||!UUID.test(discoveryId)) return null;
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netit_identity2d3_correction_queue",{
  p_organization_id:organizationId,p_discovery_id:discoveryId,p_limit:15
 });
 if(error||!data||typeof data!=="object") return null;
 const value=data as Partial<IdentityCorrectionQueue>;
 if(value.contract!=="netit-identity2d3-v1"
   || typeof value.owner_attestation_eligible!=="boolean"
   || (value.claim_target_company_id!==null&&
      (typeof value.claim_target_company_id!=="string"||!UUID.test(value.claim_target_company_id)))
   || !Number.isInteger(value.total_visible)||Number(value.total_visible)<0
   || value.changes_published!==0||value.legal_identity_verifications!==0||value.new_claims!==0
   || !Array.isArray(value.items)||value.items.length>15
   || !value.items.every(item=>
     UUID.test(item.id)&&typeof item.proposed_value==="string"
     &&item.proposed_value.length<=180
     &&typeof item.source_url==="string"
     &&typeof item.evidence_note==="string"
     &&item.evidence_note.length<=800
     &&typeof item.is_my_organization==="boolean"
     &&typeof item.can_attest==="boolean"
     &&["awaiting_owner","owner_supported","owner_disputed"].includes(item.resolution)
     &&(!item.can_attest||value.owner_attestation_eligible===true)
   )) return null;
 return value as IdentityCorrectionQueue;
}
