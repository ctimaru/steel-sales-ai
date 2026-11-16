import "server-only";
import {createClient} from "@/lib/supabase/server";

export type ProducerSourceMention={
  id:string;
  companyId:string;
  kind:"technical_standard"|"steel_grade"|"manufacturing_process"|"section_shape"|"dimension_range";
  value:string;
  sourceUrl:string;
  verifiedAt:string;
  evidenceLevel:"source_mention_only";
};

const allowed=new Set(["technical_standard","steel_grade","manufacturing_process","section_shape","dimension_range"]);

function parse(payload:unknown,companyIds:readonly string[]):ProducerSourceMention[]|null {
  if(!payload||typeof payload!=="object"||Array.isArray(payload))return null;
  const p=payload as Record<string,unknown>;
  if(p.contract!=="netproducers-auto1b-mentions-v1"||
    !Array.isArray(p.items)||p.items.length>160||
    typeof p.total!=="number"||!Number.isSafeInteger(p.total)||
    p.total!==p.items.length)return null;
  const granted=new Set(companyIds);
  const items:ProducerSourceMention[]=[];
  for(const item of p.items){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const x=item as Record<string,unknown>;
    if(typeof x.id!=="string"||
       typeof x.company_id!=="string"||!granted.has(x.company_id)||
       !allowed.has(x.claim_kind as string)||
       typeof x.claim_value!=="string"||x.claim_value.length<2||x.claim_value.length>160||
       typeof x.source_url!=="string"||
       typeof x.verified_at!=="string"||!Number.isFinite(Date.parse(x.verified_at))||
       x.evidence_level!=="source_mention_only")return null;
    let url:URL;
    try{url=new URL(x.source_url)}catch{return null}
    if(url.protocol!=="https:"||url.username||url.password||x.source_url.length>1200)return null;
    items.push({
      id:x.id,companyId:x.company_id,
      kind:x.claim_kind as ProducerSourceMention["kind"],
      value:x.claim_value,sourceUrl:x.source_url,
      verifiedAt:x.verified_at,evidenceLevel:"source_mention_only",
    });
  }
  return items;
}

/** Paid producer directory IDs only; RPC rechecks tenant and current subscription. */
export async function getProducerSourceMentions(
  organizationId:string,companyIds:readonly string[],
):Promise<ProducerSourceMention[]|null>{
  if(companyIds.length===0)return [];
  const ids=[...new Set(companyIds)];
  if(ids.length>24)return null;
  try {
    const db=await createClient();
    const {data,error}=await db.rpc("netproducers1_auto1b_mentions",{
      p_organization_id:organizationId,p_company_ids:ids,
    });
    if(error)return null;
    return parse(data,ids);
  }catch{return null;}
}
