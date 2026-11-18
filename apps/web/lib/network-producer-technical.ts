import "server-only";

import {createClient} from "@/lib/supabase/server";

export type ProducerEvidenceKind=
  "manufacturing_process"|"technical_standard"|"steel_grade"|
  "section_shape"|"dimension_range";

export type NetworkProducerTechnicalClaim={
  id:string;
  companyId:string;
  productScope:string;
  kind:ProducerEvidenceKind;
  value:string;
  sourceUrl:string;
  sourceTitle:string;
  observedAt:string;
  evidenceStatus:"first_party_observed";
  rightsStatus:"link_only";
};

const kinds=new Set<ProducerEvidenceKind>([
  "manufacturing_process","technical_standard","steel_grade",
  "section_shape","dimension_range",
]);

function safeUrl(url:string):boolean{
  try{
    const u=new URL(url);
    return u.protocol==="https:" && !u.username && !u.password &&
      !!u.hostname && url.length<=1200;
  }catch{return false;}
}

/** Strictly fail closed on any malformed or mixed-tenant RPC payload. */
export function parseProducerTechnicalClaims(input:unknown):NetworkProducerTechnicalClaim[]|null{
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const payload=input as Record<string,unknown>;
  if(payload.contract!=="netproducers1-technical-claims-v1"||
     !Array.isArray(payload.items)||payload.items.length>160||
     typeof payload.total!=="number"||!Number.isSafeInteger(payload.total)||
     payload.total!==payload.items.length)return null;
  const claims:NetworkProducerTechnicalClaim[]=[];
  for(const raw of payload.items){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
    const c=raw as Record<string,unknown>;
    if(typeof c.id!=="string" || typeof c.company_id!=="string"||
       typeof c.product_scope!=="string"||c.product_scope.length>96||
       !kinds.has(c.claim_kind as ProducerEvidenceKind)||
       typeof c.claim_value!=="string"||c.claim_value.length>200||
       typeof c.source_url!=="string"||!safeUrl(c.source_url)||
       typeof c.source_title!=="string"||c.source_title.length>160||
       typeof c.observed_at!=="string"||!Number.isFinite(Date.parse(c.observed_at))||
       c.evidence_status!=="first_party_observed"||
       c.rights_status!=="link_only")return null;
    claims.push({
      id:c.id,companyId:c.company_id,productScope:c.product_scope,
      kind:c.claim_kind as ProducerEvidenceKind,value:c.claim_value,
      sourceUrl:c.source_url,sourceTitle:c.source_title,
      observedAt:c.observed_at,
      evidenceStatus:"first_party_observed",rightsStatus:"link_only",
    });
  }
  return claims;
}

/**
 * Caller must pass IDs from the authorized scoped producer directory.
 * Supabase checks tenant/organization and current producer+IT subscription again.
 * Never use a service role, cache a cross-tenant result, or query the table.
 */
export async function getProducerTechnicalClaims(
  organizationId:string,companyIds:readonly string[],country="IT",
):Promise<NetworkProducerTechnicalClaim[]|null>{
  if(companyIds.length===0)return [];
  const ids=[...new Set(companyIds)];
  if(ids.length>24)return null;
  try{
    const db=await createClient();
    const {data,error}=country==="IT"
      ?await db.rpc("netproducers1_technical_claims",{
        p_organization_id:organizationId,p_company_ids:ids,
      })
      :await db.rpc("net_eu_tubifici1_c2_factory_claims",{
        p_organization_id:organizationId,p_country:country,p_company_ids:ids,
      });
    if(error)return null;
    const claims=parseProducerTechnicalClaims(data);
    if(!claims)return null;
    const allowed=new Set(ids);
    return claims.every(c=>allowed.has(c.companyId))?claims:null;
  }catch{return null;}
}
