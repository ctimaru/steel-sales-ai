import "server-only";
import {createClient} from "@/lib/supabase/server";

export type NetworkReplyIntelligence={
 contract:"netconnect2f-intelligence-v1";organization_id:string;period_days:90;
 sent:number;accepted:number;declined:number;decided_with_timestamp:number;
 median_decision_hours:number|null;pending_over_7_days:number;
 items:{company_id:string;shared_public_products:string[]}[];
};
const isCount=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
/** One governed per-organization read. Never substitute zeros for a failed RPC. */
export async function getNetworkReplyIntelligence(organizationId:string,companyIds:string[]=[]):
 Promise<NetworkReplyIntelligence>{
 const distinct=[...new Set(companyIds)];
 if(distinct.length>24)throw new Error("netconnect2f_batch_too_large");
 const db=await createClient();
 const {data,error}=await db.rpc("netconnect2f_intelligence",{
  p_organization_id:organizationId,p_company_ids:distinct,
 });
 if(error)throw new Error("netconnect2f_unavailable");
 const result=data as NetworkReplyIntelligence|null;
 if(!result||result.contract!=="netconnect2f-intelligence-v1"||
   result.organization_id!==organizationId||result.period_days!==90||
   ![result.sent,result.accepted,result.declined,result.decided_with_timestamp,
     result.pending_over_7_days].every(isCount)||
   result.accepted+result.declined>result.sent||
   result.decided_with_timestamp>result.accepted+result.declined||
   (result.median_decision_hours!==null&&
     (result.decided_with_timestamp<3||typeof result.median_decision_hours!=="number"||
      !Number.isFinite(result.median_decision_hours)||result.median_decision_hours<0))||
   (result.median_decision_hours===null&&result.decided_with_timestamp>=3)||
   !Array.isArray(result.items)||result.items.length!==distinct.length) {
  throw new Error("netconnect2f_invalid_contract");
 }
 const expected=new Set(distinct);
 const found=new Set<string>();
 for(const item of result.items){
  if(!item||!expected.has(item.company_id)||found.has(item.company_id)||
    !Array.isArray(item.shared_public_products)||
    item.shared_public_products.length>2||
    !item.shared_public_products.every(x=>typeof x==="string"&&x.length<=200))
   throw new Error("netconnect2f_invalid_item");
  found.add(item.company_id);
 }
 return result;
}
export function sharedPublicProducts(result:NetworkReplyIntelligence|null){
 return new Map((result?.items??[]).map(x=>[x.company_id,x.shared_public_products]));
}
