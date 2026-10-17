import "server-only";
import {createClient} from "@/lib/supabase/server";

export type CompanyNetworkGrowth={
  contract:"netconnect2d-company-growth-v1";
  organization_id:string;
  owned_company_id:string|null;
  claim_requests_pending:number;
  requests_sent:number;
  requests_accepted:number;
  requests_received_pending:number;
};

/** A single SQL-protected read scoped to active organization membership. */
export async function getCompanyNetworkGrowth(organizationId:string):Promise<CompanyNetworkGrowth>{
  const db=await createClient();
  const {data,error}=await db.rpc("netconnect2d_company_progress",{p_organization_id:organizationId});
  if(error)throw new Error("company_network_growth_unavailable");
  const result=data as CompanyNetworkGrowth|null;
  if(!result||result.contract!=="netconnect2d-company-growth-v1"||
     result.organization_id!==organizationId||
     !("owned_company_id" in result)||
     !["claim_requests_pending","requests_sent","requests_accepted","requests_received_pending"]
       .every(key=>(typeof result[key as keyof CompanyNetworkGrowth]==="number" &&
          Number.isInteger(result[key as keyof CompanyNetworkGrowth] as number) &&
          (result[key as keyof CompanyNetworkGrowth] as number)>=0))) {
    throw new Error("company_network_growth_invalid_contract");
  }
  return result;
}
