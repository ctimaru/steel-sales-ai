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
