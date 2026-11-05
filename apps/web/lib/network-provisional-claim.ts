import "server-only";
import {createClient} from "@/lib/supabase/server";
export type ProvisionalClaimState={
 contract:string;status:"not_requested"|"requested"|"under_review"|"ready_for_claim"|"rejected";
 request_id:string|null;canonical_company_id:string|null;review_note?:string|null;
 ownership_granted:boolean;verified_supplier:boolean;
};
export type ReconciliationQueueRow={
 request_id:string;discovery_id:string;source_domain:string;source_name:string;source_url:string;
 organization_id:string;organization_name:string;
 status:"requested"|"under_review"|"ready_for_claim"|"rejected";
 request_note:string|null;requested_at:string;canonical_company_id:string|null;
 has_activated_strong_match:boolean;
};
export type ReconciliationQueue={contract:string;total_pending:number;items:ReconciliationQueueRow[];};
export async function getMyProvisionalReconciliation(discoveryId:string,organizationId:string):Promise<ProvisionalClaimState>{
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netgrowth3g3_my_reconciliation",{
  p_discovery_id:discoveryId,p_organization_id:organizationId
 });
 if(error)throw new Error("netgrowth3g3_my_reconciliation_unavailable");
 return data as ProvisionalClaimState;
}
export async function getProvisionalReconciliationQueue():Promise<ReconciliationQueue>{
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netgrowth3g3_review_queue",{p_limit:50});
 if(error)throw new Error("netgrowth3g3_reconciliation_queue_unavailable");
 const parsed=data as Partial<ReconciliationQueue>|null;
 if(parsed?.contract!=="netgrowth3g3-platform-v1"||!Array.isArray(parsed.items))
  throw new Error("netgrowth3g3_reconciliation_queue_invalid_contract");
 return {contract:parsed.contract,total_pending:Number(parsed.total_pending||0),items:parsed.items};
}
