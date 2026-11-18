import "server-only";

import {createClient} from "@/lib/supabase/server";

export type CataloguePreviewObservation={
  kind:"technical_standard"|"steel_grade"|"section_shape"|"dimension_range"|"manufacturing_process";
  value:string;
  scope:string;
  sourceTitle:string;
};
export type CataloguePreviewSource={
  id:string;
  companyId:string;
  companyName:string;
  title:string;
  sourceUrl:string;
  documentType:"official_pdf"|"official_catalog_page";
  editionYear:number|null;
  status:"producer_confirmation_pending";
  observations:CataloguePreviewObservation[];
};
export type CataloguePreview={
  sourcesTotal:number;
  producersTotal:number;
  observationsTotal:number;
  items:CataloguePreviewSource[];
};

const kinds=new Set(["technical_standard","steel_grade","section_shape","dimension_range","manufacturing_process"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function httpsUrl(value:unknown):value is string {
  if(typeof value!=="string"||value.length>1200)return false;
  try{
    const url=new URL(value);
    return url.protocol==="https:" && !url.username && !url.password &&
      !url.hash && !!url.hostname;
  }catch{return false;}
}
function boundedNumber(x:unknown,max:number):x is number{
  return typeof x==="number"&&Number.isSafeInteger(x)&&x>=0&&x<=max;
}

/**
 * Public-source facts are a discovery preview; never authorize an exact
 * grade×shape×size combination, manufacturer capacity, licensed PDF bytes,
 * B2 grant, private submission or an RFQ without confirmation.
 */
export function parseCataloguePreview(input:unknown):CataloguePreview|null {
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const body=input as Record<string,unknown>;
  if(body.contract!=="netproducers-catalog-preview-v1"||
     !boundedNumber(body.sources_total,10000)||
     !boundedNumber(body.producers_total,10000)||
     !boundedNumber(body.observations_total,100000)||
     body.manufacturer_confirmed!==0||body.exact_skus_verified!==0||
     body.document_copies!==0||!Array.isArray(body.items)||
     body.items.length>24||body.count!==body.items.length)return null;
  const items:CataloguePreviewSource[]=[];
  for(const entry of body.items){
    if(!entry||typeof entry!=="object"||Array.isArray(entry))return null;
    const item=entry as Record<string,unknown>;
    if(typeof item.id!=="string"||!uuid.test(item.id)||
       typeof item.company_id!=="string"||!uuid.test(item.company_id)||
       typeof item.company_name!=="string"||item.company_name.length>220||
       typeof item.title!=="string"||item.title.length>220||
       !httpsUrl(item.source_url)||
       (item.document_type!=="official_pdf"&&item.document_type!=="official_catalog_page")||
       (item.edition_year!==null&&!boundedNumber(item.edition_year,2100))||
       item.status!=="producer_confirmation_pending"||
       !Array.isArray(item.observations)||item.observations.length>25)return null;
    const observations:CataloguePreviewObservation[]=[];
    for(const raw of item.observations){
      if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
      const obs=raw as Record<string,unknown>;
      if(!kinds.has(obs.kind as string)||
         typeof obs.value!=="string"||obs.value.length>200||
         typeof obs.scope!=="string"||obs.scope.length>96||
         typeof obs.source_title!=="string"||obs.source_title.length>160)return null;
      observations.push({
        kind:obs.kind as CataloguePreviewObservation["kind"],
        value:obs.value,scope:obs.scope,sourceTitle:obs.source_title,
      });
    }
    items.push({
      id:item.id,companyId:item.company_id,
      companyName:item.company_name,title:item.title,
      sourceUrl:item.source_url,
      documentType:item.document_type,editionYear:item.edition_year as number|null,
      status:"producer_confirmation_pending",observations,
    });
  }
  return {
    sourcesTotal:body.sources_total as number,
    producersTotal:body.producers_total as number,
    observationsTotal:body.observations_total as number,
    items,
  };
}

export async function getCataloguePreview(search:string):Promise<CataloguePreview|null>{
  try{
    const db=await createClient();
    const {data,error}=await db.rpc("netproducers1_catalog_observed_preview",{
      p_search:search.slice(0,80),p_limit:24,
    });
    return error?null:parseCataloguePreview(data);
  }catch{return null;}
}
