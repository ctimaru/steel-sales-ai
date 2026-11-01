import "server-only";

import {createClient} from "@/lib/supabase/server";

/** NET-AUDIT1.2 — capability labels for exactly the companies on a list page.
 *
 * Same source as the company profile ("capability pubblicate sulle sedi") and
 * the M6 technical search: capabilities attached to PUBLISHED, non-archived
 * facilities. Reads run as the authenticated viewer, so the existing RLS
 * policies on network_facilities / network_facility_capabilities still decide
 * what is visible; no service key, no private tenant data, no new RPC.
 *
 * Unconfirmed discoveries have no facilities and simply get no labels.
 * Any read failure degrades to "no labels" instead of breaking the page.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMPANIES=24;

type FacilityRow={id:string;company_id:string};
type FacilityCapabilityRow={facility_id:string;capability_id:string};
type CapabilityRow={id:string;canonical_key:string;display_name:string;sort_order:number|null};

/** Pure merge step, exported for tests: one ordered, de-duplicated list per company. */
export function groupCapabilityLabels(
  companyIds:ReadonlyArray<string>,facilities:ReadonlyArray<FacilityRow>,
  links:ReadonlyArray<FacilityCapabilityRow>,capabilities:ReadonlyArray<CapabilityRow>,
):Record<string,string[]>{
  const capabilityById=new Map(capabilities.map(cap=>[cap.id,cap]));
  const companyByFacility=new Map(facilities.map(facility=>[facility.id,facility.company_id]));
  const perCompany=new Map<string,Map<string,CapabilityRow>>();
  for(const link of links){
    const companyId=companyByFacility.get(link.facility_id);
    const capability=capabilityById.get(link.capability_id);
    if(!companyId||!capability)continue;
    const byKey=perCompany.get(companyId)??new Map<string,CapabilityRow>();
    byKey.set(capability.canonical_key,capability);
    perCompany.set(companyId,byKey);
  }
  const result:Record<string,string[]>={};
  for(const id of companyIds){
    const byKey=perCompany.get(id);
    result[id]=byKey?[...byKey.values()].sort((a,b)=>
      (a.sort_order??9999)-(b.sort_order??9999)||a.display_name.localeCompare(b.display_name,"it"),
    ).map(cap=>cap.display_name):[];
  }
  return result;
}

export async function getPublishedCapabilityLabels(
  companyIds:ReadonlyArray<string>,
):Promise<Record<string,string[]>>{
  const ids=[...new Set(companyIds.filter(id=>UUID.test(id)))].slice(0,MAX_COMPANIES);
  if(!ids.length)return {};
  try{
    const supabase=await createClient();
    const {data:facilities,error:facilityError}=await supabase.from("network_facilities")
      .select("id,company_id").in("company_id",ids)
      .eq("publication_status","published").is("archived_at",null);
    if(facilityError||!facilities?.length)return {};
    const facilityIds=(facilities as FacilityRow[]).map(facility=>facility.id);
    const {data:links,error:linkError}=await supabase.from("network_facility_capabilities")
      .select("facility_id,capability_id").in("facility_id",facilityIds);
    if(linkError||!links?.length)return {};
    const capabilityIds=[...new Set((links as FacilityCapabilityRow[]).map(link=>link.capability_id))];
    const {data:capabilities,error:capabilityError}=await supabase.from("network_capabilities")
      .select("id,canonical_key,display_name,sort_order").in("id",capabilityIds).eq("status","active");
    if(capabilityError||!capabilities)return {};
    return groupCapabilityLabels(ids,facilities as FacilityRow[],
      links as FacilityCapabilityRow[],capabilities as CapabilityRow[]);
  }catch{
    return {};
  }
}
