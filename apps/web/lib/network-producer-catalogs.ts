import "server-only";

import {createClient} from "@/lib/supabase/server";

export type NetworkProducerCatalogLink={
  id:string;
  companyId:string;
  title:string;
  sourceUrl:string;
  documentType:"official_pdf"|"official_catalog_page";
  languageCodes:string[];
  editionYear:number|null;
  rightsStatus:"link_only";
  sourceStatus:"official_link_observed";
};

type CatalogIndexPayload={
  contract?:unknown;
  total?:unknown;
  items?:unknown;
};

export function parseNetworkProducerCatalogLinks(input:unknown):NetworkProducerCatalogLink[]|null{
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const object=input as CatalogIndexPayload;
  if(object.contract!=="netproducers1-catalog-index-v1"||
    !Array.isArray(object.items)||
    typeof object.total!=="number"||
    !Number.isSafeInteger(object.total)||
    object.total!==object.items.length||
    object.items.length>60)return null;
  const links:NetworkProducerCatalogLink[]=[];
  for(const item of object.items){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const value=item as Record<string,unknown>;
    if(typeof value.id!=="string"||
      typeof value.company_id!=="string"||
      typeof value.title!=="string"||value.title.length>220||
      typeof value.source_url!=="string"||
      !Array.isArray(value.language_codes)||
      !value.language_codes.every(code=>typeof code==="string"&&code.length<=8)||
      (value.edition_year!==null&&(typeof value.edition_year!=="number"||
       !Number.isSafeInteger(value.edition_year)))||
      (value.document_type!=="official_pdf"&&value.document_type!=="official_catalog_page")||
      value.rights_status!=="link_only"||
      value.source_status!=="official_link_observed")return null;
    try{
      const url=new URL(value.source_url);
      if(url.protocol!=="https:"||url.username||url.password)return null;
    }catch{return null;}
    links.push({
      id:value.id,
      companyId:value.company_id,
      title:value.title,
      sourceUrl:value.source_url,
      documentType:value.document_type,
      languageCodes:value.language_codes as string[],
      editionYear:value.edition_year as number|null,
      rightsStatus:"link_only",
      sourceStatus:"official_link_observed",
    });
  }
  return links;
}

/**
 * The RPC enforces the current organization + producers/IT entitlement.
 * This function only receives IDs already returned by an authorized
 * manufacturer directory result. Do not use service role credentials.
 */
export async function getNetworkProducerCatalogLinks(
  organizationId:string,companyIds:readonly string[]
):Promise<NetworkProducerCatalogLink[]|null>{
  if(!companyIds.length)return [];
  if(companyIds.length>24)return null;
  try{
    const db=await createClient();
    const {data,error}=await db.rpc("netproducers1_catalog_index",{
      p_organization_id:organizationId,
      p_company_ids:[...new Set(companyIds)],
    });
    if(error)return null;
    const parsed=parseNetworkProducerCatalogLinks(data);
    if(!parsed)return null;
    const allowed=new Set(companyIds);
    if(parsed.some(link=>!allowed.has(link.companyId)))return null;
    return parsed;
  }catch{return null;}
}
