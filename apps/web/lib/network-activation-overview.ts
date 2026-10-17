import "server-only";

import {createClient} from "@/lib/supabase/server";

export type NetworkActivationCounts = {
 published:number;provisional_visible:number;registration_applications:number;
 registrations_activated:number;claims_pending:number;claims_approved:number;
 companies_linked_and_claim_approved:number;canonical_evidence_links:number;
 registration_strong_matches:number;registration_ambiguous_matches:number;
};
export type NetworkReconciliationProposal = {
 discovery_id:string;origin:string;domain:string;discovered_name:string;
 application_id:string;applicant_company:string;application_status:string;
 match_state:"strong_evidence"|"ambiguous_review";
};
export type NetworkActivationOverview = {
 contract:"netconnect2b-activation-v1";
 counts:NetworkActivationCounts;
 proposals:NetworkReconciliationProposal[];
 snapshot_at:string;
};

/** Platform owner permission enforced in PostgreSQL (not only React). */
export async function getNetworkActivationOverview():Promise<NetworkActivationOverview>{
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netconnect2b_activation_overview");
 if(error)throw new Error("network_activation_overview_unavailable");
 const result=data as NetworkActivationOverview|null;
 if(!result||result.contract!=="netconnect2b-activation-v1"||
    !result.counts||!Array.isArray(result.proposals)||
    typeof result.counts.companies_linked_and_claim_approved!=="number") {
  throw new Error("network_activation_overview_invalid_contract");
 }
 return result;
}
