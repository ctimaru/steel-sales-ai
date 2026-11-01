import "server-only";

import {createClient} from "@/lib/supabase/server";
import type {FreeCompany} from "@/lib/network-free";
import type {NetworkSpecFilters} from "@/lib/network-spec-filters";

/** NET-AUDIT1.1 — Pro-only spec search on the published technical scope.
 * The RPC enforces the paid Network guard; this module only validates the
 * contract. Rows are flagged `exact` (declared and matching) or `undeclared`
 * (no declared scope for some criterion): undeclared is never "compatible".
 */
export type SpecEvidence={
  standards:{code:string;verification_status:string;provenance_kind:string}[];
  grades:{designation:string;standard_code:string;verification_status:string;provenance_kind:string}[];
  dimensions:{dimension_type:string;min_mm:number;max_mm:number;verification_status:string;provenance_kind:string}[];
};
export type SpecMatch={status:"exact"|"undeclared"}&SpecEvidence;
export type SpecCompany=FreeCompany&{spec_match:SpecMatch};
export type NetworkSpecPage={
  items:SpecCompany[];total:number;exactTotal:number;undeclaredTotal:number;
};

type RpcPayload={
  contract?:string;total?:number;exact_total?:number;undeclared_total?:number;items?:unknown;
};

function isSpecCompany(value:unknown):value is SpecCompany{
  if(!value||typeof value!=="object")return false;
  const row=value as Partial<SpecCompany>;
  return typeof row.id==="string"&&typeof row.legal_name==="string"&&Array.isArray(row.roles)
    &&Array.isArray(row.products)&&!!row.spec_match
    &&(row.spec_match.status==="exact"||row.spec_match.status==="undeclared")
    &&Array.isArray(row.spec_match.standards)&&Array.isArray(row.spec_match.grades)
    &&Array.isArray(row.spec_match.dimensions);
}

export async function getNetworkSpecPage(
  organizationId:string,spec:NetworkSpecFilters,
  filters:{q?:string;role?:string;region?:string},offset:number,limit:number,
):Promise<NetworkSpecPage>{
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("netaudit1_spec_search",{
    p_organization_id:organizationId,
    p_standard:spec.std??null,p_grade:spec.grade??null,p_shape:spec.shape??null,
    p_outer_diameter_mm:spec.od??null,p_wall_thickness_mm:spec.wt??null,p_side_mm:spec.side??null,
    p_role:filters.role||null,p_region:(filters.region??"").trim().slice(0,90)||null,
    p_query:(filters.q??"").trim().slice(0,120)||null,
    p_offset:Math.max(0,offset),p_limit:limit,
  });
  if(error||!data||typeof data!=="object")throw new Error("network_spec_search_unavailable");
  const payload=data as RpcPayload;
  if(payload.contract!=="netaudit1-spec-v1"||!Array.isArray(payload.items)
     ||typeof payload.total!=="number"||typeof payload.exact_total!=="number")
    throw new Error("network_spec_search_invalid_contract");
  return {
    items:payload.items.filter(isSpecCompany),
    total:payload.total,exactTotal:payload.exact_total,
    undeclaredTotal:Math.max(0,payload.total-payload.exact_total),
  };
}
