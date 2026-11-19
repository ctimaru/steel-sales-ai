import "server-only";
import {createClient} from "@/lib/supabase/server";
import {isSupportedNetworkCountry} from "@/lib/network-eu-countries";
import type {EuProducerSearchIntent} from "@/lib/eu-producer-intelligence-intent";

export type EuProducerSearchEvidence={
  id:string;kind:"technical_standard"|"steel_grade"|"section_shape";
  value:string;sourceUrl:string;sourceTitle:string;observedAt:string;
};
export type EuProducerSearchCompany={
  companyId:string;name:string;countryCode:string;websiteUrl:string|null;
  matchedCriteria:number;requestedCriteria:number;
  status:"attributes_observed_separately"|"partial_observations";
  evidence:EuProducerSearchEvidence[];
};
export type EuProducerSearchResponse=
 |{status:"ready";companies:EuProducerSearchCompany[]}
 |{status:"locked"|"unavailable";companies:[]};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(["technical_standard","steel_grade","section_shape"]);
function object(x:unknown):Record<string,unknown>|null{
  return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:null;
}
function https(value:unknown):value is string{
  if(typeof value!=="string"||value.length>1200)return false;
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&!url.username&&!url.password&&!!url.hostname;
  }catch{return false;}
}
/** Duplicate strict contract validation: an LLM and a browser can NEVER
 * inject companies, claims, sources, entitlement or exact compatibility. */
export function parseEuProducerSearchResponse(
  raw:unknown,requestedCriteria:number,
):EuProducerSearchCompany[]|null{
  const p=object(raw);
  if(p?.contract!=="net-eu-producer-intelligence-e1-v1"||
     p.requested_criteria!==requestedCriteria ||
     typeof p.total!=="number" || !Number.isSafeInteger(p.total) ||
     !Array.isArray(p.items)||p.items.length>12||p.total!==p.items.length)return null;
  const results:EuProducerSearchCompany[]=[];
  const seen=new Set<string>();
  for(const value of p.items){
    const item=object(value);
    if(!item||typeof item.company_id!=="string"||!UUID.test(item.company_id)||
       seen.has(item.company_id)||typeof item.name!=="string"||
       !item.name.trim()||item.name.length>600||
       typeof item.country_code!=="string"||
       !isSupportedNetworkCountry(item.country_code)||
       ["IT","US"].includes(item.country_code)||
       (item.website_url!==null&&!https(item.website_url))||
       item.requested_criteria!==requestedCriteria||
       typeof item.matched_criteria!=="number"||
       !Number.isSafeInteger(item.matched_criteria)||
       item.matched_criteria<1||item.matched_criteria>requestedCriteria||
       item.match_status!==(item.matched_criteria===requestedCriteria?
         "attributes_observed_separately":"partial_observations")||
       item.exact_combination_confirmed!==false||item.manufacturer_confirmed!==false||
       !Array.isArray(item.evidence)||item.evidence.length<1||item.evidence.length>8)return null;
    const evidence:EuProducerSearchEvidence[]=[];
    for(const v of item.evidence){
      const e=object(v);
      if(!e||typeof e.id!=="string"||!UUID.test(e.id)||
         typeof e.kind!=="string"||!kinds.has(e.kind)||
         typeof e.value!=="string"||!e.value.trim()||e.value.length>200||
         !https(e.source_url)||typeof e.source_title!=="string"||
         e.source_title.length>160||
         typeof e.observed_at!=="string"||!Number.isFinite(Date.parse(e.observed_at)))return null;
      evidence.push({id:e.id,kind:e.kind as EuProducerSearchEvidence["kind"],
        value:e.value,sourceUrl:e.source_url,sourceTitle:e.source_title,
        observedAt:e.observed_at});
    }
    if(new Set(evidence.map(e=>e.kind)).size!==item.matched_criteria)return null;
    seen.add(item.company_id);
    results.push({companyId:item.company_id,name:item.name,countryCode:item.country_code,
      websiteUrl:item.website_url as string|null,matchedCriteria:item.matched_criteria,
      requestedCriteria,status:item.match_status as EuProducerSearchCompany["status"],
      evidence});
  }
  return results;
}
export async function searchEuProducersBySource(
 organizationId:string,intent:EuProducerSearchIntent,
):Promise<EuProducerSearchResponse>{
  const requestedCriteria=Number(Boolean(intent.standard))+Number(Boolean(intent.grade))+
    Number(Boolean(intent.shape));
  if(requestedCriteria<1||intent.country==="IT")return {status:"unavailable",companies:[]};
  try{
    const db=await createClient();
    const {data,error}=await db.rpc("net_eu_tubifici1_e1_search",{
      p_organization_id:organizationId,p_standard:intent.standard,
      p_grade:intent.grade,p_shape:intent.shape,p_country:intent.country,p_max:12,
    });
    if(error)return {status:error.code==="42501"?"locked":"unavailable",companies:[]};
    const companies=parseEuProducerSearchResponse(data,requestedCriteria);
    return companies?{status:"ready",companies}:{status:"unavailable",companies:[]};
  }catch{return {status:"unavailable",companies:[]};}
}
