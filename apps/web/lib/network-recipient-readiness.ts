import "server-only";
import {createClient} from "@/lib/supabase/server";

export type RecipientReadinessStatus="available"|"pending"|"connected"|"unavailable";
type Batch={contract:"netconnect2e-readiness-v1";organization_id:string;items:{company_id:string;status:RecipientReadinessStatus}[]};
const validStates=new Set<RecipientReadinessStatus>(["available","pending","connected","unavailable"]);

/** Bound to active Network membership in SQL. No fallback to optimistic eligibility. */
export async function getNetworkRecipientReadiness(organizationId:string,ids:string[]):Promise<Map<string,RecipientReadinessStatus>>{
  const distinct=[...new Set(ids)];
  if(distinct.length===0)return new Map();
  if(distinct.length>24)throw new Error("network_readiness_batch_too_large");
  const db=await createClient();
  const {data,error}=await db.rpc("netconnect2e_readiness",{
    p_organization_id:organizationId,p_company_ids:distinct
  });
  if(error)throw new Error("network_readiness_unavailable");
  const result=data as Batch|null;
  if(!result||result.contract!=="netconnect2e-readiness-v1"||result.organization_id!==organizationId||
     !Array.isArray(result.items))throw new Error("network_readiness_invalid_contract");
  const expected=new Set(distinct);
  const statuses=new Map<string,RecipientReadinessStatus>();
  for(const entry of result.items){
    if(!entry||!expected.has(entry.company_id)||statuses.has(entry.company_id)||
       !validStates.has(entry.status))throw new Error("network_readiness_invalid_entry");
    statuses.set(entry.company_id,entry.status);
  }
  if(statuses.size!==distinct.length)throw new Error("network_readiness_incomplete");
  return statuses;
}
