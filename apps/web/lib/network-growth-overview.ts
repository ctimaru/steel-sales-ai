import "server-only";

import {createClient} from "@/lib/supabase/server";

type CohortStage={submitted:number;activated:number;owned:number;requested:number;accepted:number};
export type NetworkGrowthOverview={
 contract:"netconnect2c-growth-v1";
 period:"rolling_30_days";time_basis:"UTC";current_state_cohorts:true;
 cohort_30d:CohortStage;
 weeks:(CohortStage&{week_start:string})[];
 network:{
  owned_companies:number;owned_without_outreach:number;
  approved_applications_pending_activation:number;
  requests_last_30d:number;accepted_last_30d:number;
  companies_with_accepted_connection:number;
 };
 snapshot_at:string;
};

/** Company data is protected inside the owner-only SQL function. */
export async function getNetworkGrowthOverview():Promise<NetworkGrowthOverview>{
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netconnect2c_growth_overview");
 if(error)throw new Error("network_growth_overview_unavailable");
 const result=data as NetworkGrowthOverview|null;
 if(!result||result.contract!=="netconnect2c-growth-v1"||
   !result.cohort_30d||!result.network||!Array.isArray(result.weeks)||
   result.weeks.some(week=>typeof week.submitted!=="number")) {
  throw new Error("network_growth_overview_invalid_contract");
 }
 return result;
}
