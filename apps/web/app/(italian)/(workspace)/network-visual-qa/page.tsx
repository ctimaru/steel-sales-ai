import {notFound} from "next/navigation";
import {NetworkCompactExperience} from "@/components/network-compact-experience";
import {getWorkspaceContext} from "@/lib/workspace-context";
import type {CompactNetworkFilters,CompactNetworkPage} from "@/lib/network-compact-directory";

/**
 * NET-UX-FILTERS1: visual-only local fixture to exercise the *real* compact
 * Network layout even when synthetic GoTrue accounts land on the legacy
 * discovery fallback. Never reachable in production or on hosted previews.
 * All companies are fictional labels; no real contacts, claims or RFQs.
 */
export const dynamic="force-dynamic";

const filters:CompactNetworkFilters={country:"IT"};
const directory:CompactNetworkPage={
  items:[
    {
      id:"00000000-0000-0000-0000-000000000091",
      legal_name:"DEMO Tubi Strutturali",
      trading_name:null,
      country_code:"IT",
      website_url:null,
      verification_status:"unverified",
      claimed_status:"unclaimed",
      roles:[{key:"producer",name:"Produttore",is_primary:true}],
      products:["Tubi"],
      location:{city:"Milano",region:"Lombardia"},
    },
    {
      id:"00000000-0000-0000-0000-000000000092",
      legal_name:"DEMO Carpenteria Tecnica",
      trading_name:null,
      country_code:"IT",
      website_url:null,
      verification_status:"unverified",
      claimed_status:"unclaimed",
      roles:[{key:"processor_service_provider",name:"Terzista",is_primary:true}],
      products:["Profilati cavi"],
      location:{city:"Bergamo",region:"Lombardia"},
    },
  ],
  total:2,published:2,discovered:0,
  page:1,pages:1,first:1,last:2,discoveryUnavailable:false,
};

export default async function NetworkVisualQaPage(){
  if(process.env.NODE_ENV!=="development"||
     process.env.FLOW1_LOCAL_PROVIDER!=="true"||
     process.env.NETWORK_VISUAL_FIXTURE!=="true")notFound();
  const {organizationId,userId}=await getWorkspaceContext();
  return <NetworkCompactExperience
    accessMode="pro" directory={directory} filters={filters}
    organizationId={organizationId} userId={userId} canCompose={false}
    additionalFilters={{
      products:[{canonical_key:"tubes_pipes",display_name:"Tubi"},{canonical_key:"hollow_sections",display_name:"Profilati cavi"}],
      capabilities:[{canonical_key:"welding_fabrication",display_name:"Saldatura e carpenteria"}],
      markets:[{canonical_key:"construction_infrastructure",display_name:"Edilizia e infrastrutture"}],
    }}
  />;
}
