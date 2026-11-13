import "server-only";
import {createClient} from "@/lib/supabase/server";

export type ReviewedCompanyEvidence={field_key:string;field_value:unknown;evidence_url:string;fetched_at:string};

export async function getReviewedCompanyEvidence(organizationId:string,companyId:string,accessMode:"free"|"pro"){
 const db=await createClient();
 const {data,error}=await db.rpc("netprofile1d_profile_evidence",{
  p_organization_id:organizationId,p_company_id:companyId,p_access:accessMode
 });
 if(error||data?.contract!=="netprofile1d-evidence-v1"||!Array.isArray(data.items))return [];
 return (data.items as ReviewedCompanyEvidence[]).filter(x=>
  ["description","products","services","industry","city","region","website"].includes(x.field_key)
  && typeof x.evidence_url==="string" && /^https:\/\//.test(x.evidence_url)
 ).slice(0,20);
}


/** NET-PROFILE-DATA1 — only reviewed, source-linked evidence belongs on company pages.
 * Candidate rows are excluded by the RPC. Unstructured objects and overlong
 * snippets never become verified product capabilities or stock claims.
 */
export type SourceBackedCompanySummary={
 description: string|null;
 products: string[];
 services: string[];
 evidenceSourceUrl: string|null;
};

export function summarizeReviewedCompanyEvidence(entries:readonly ReviewedCompanyEvidence[]):SourceBackedCompanySummary{
 const facts:SourceBackedCompanySummary={description:null,products:[],services:[],evidenceSourceUrl:null};
 const seenProducts=new Set<string>();
 const seenServices=new Set<string>();
 for(const item of entries.slice(0,20)){
   if(!["description","products","services"].includes(item.field_key)
     ||typeof item.evidence_url!=="string"
     ||!/^https:\/\//i.test(item.evidence_url))continue;
   const src=item.evidence_url;
   const strings=typeof item.field_value==="string" ? [item.field_value]:
     Array.isArray(item.field_value) ? item.field_value.filter((v):v is string=>typeof v==="string"):[];
   const values=strings.map(x=>x.trim()).filter(x=>x.length>0&&x.length<=320);
   if(!values.length)continue;
   if(item.field_key==="description"&&!facts.description){
     facts.description=values[0].slice(0,280);
   }else if(item.field_key==="products"||item.field_key==="services"){
     const list=item.field_key==="products" ? facts.products : facts.services;
     const seen=item.field_key==="products" ? seenProducts : seenServices;
     for(const v of values){
       if(v.length>96)continue;
       const key=v.toLocaleLowerCase("it");
       if(seen.has(key)||list.length>=8)continue;
       seen.add(key);
       list.push(v);
     }
   }
   if(!facts.evidenceSourceUrl&&(facts.description||facts.products.length||facts.services.length)){
     facts.evidenceSourceUrl=src;
   }
 }
 return facts;
}
