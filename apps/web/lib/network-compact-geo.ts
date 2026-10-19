import "server-only";
import {createClient} from "@/lib/supabase/server";
import type {FreeCompany} from "@/lib/network-free";

/** Add factual locality only for the six companies already included by the
 * RLS/tenant-gated browse page. A sourced candidate stays UNVERIFIED and is
 * never recorded as a published facility.
 */
type GeoEvidence={
  id:string;city:string|null;region:string|null;
  source_url:string|null;geography_status:"published"|"sourced_unverified";
};
type GeoEvidenceResponse={contract:string;items:GeoEvidence[]};

export async function withCompactGeoEvidence(
  organizationId:string,access:"free"|"pro",items:FreeCompany[],
):Promise<FreeCompany[]>{
  if(!items.length)return items;
  const ids=items.map(company=>company.id).slice(0,24);
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("netcompact4_geo_overlay",{
    p_organization_id:organizationId,p_access:access,p_company_ids:ids,
  });
  if(error||!data||typeof data!=="object")return items;
  const payload=data as GeoEvidenceResponse;
  if(payload.contract!=="netcompact4-geo-v1"||!Array.isArray(payload.items))return items;
  const requested=new Set(ids);
  const byId=new Map(payload.items.filter(candidate=>
    candidate && typeof candidate.id==="string" && requested.has(candidate.id) &&
    ["published","sourced_unverified"].includes(candidate.geography_status)
  ).map(candidate=>[candidate.id,candidate]));
  return items.map(company=>{
    const sourced=byId.get(company.id);
    if(!sourced)return company;
    const existing=company.location;
    const hasExisting=Boolean(existing?.city||existing?.region);
    const location=hasExisting?existing:
      (sourced.city||sourced.region?{city:sourced.city,region:sourced.region}:null);
    // Preserve the original source's recorded status. If an authoritative
    // published facility exists, it takes precedence over a provisional city.
    const geography_status=sourced.geography_status==="published"
      ? "published" as const
      : (company.geography_status||"sourced_unverified");
    return {
      ...company,location,geography_status,
      geo_source_url:sourced.geography_status==="sourced_unverified"
        ? sourced.source_url : null,
    };
  });
}
